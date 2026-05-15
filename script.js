var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

function obtenerFechaAR() {
    var d = new Date();
    return String(d.getDate()).padStart(2, '0') + "/" + 
           String(d.getMonth() + 1).padStart(2, '0') + "/" + 
           d.getFullYear();
}

function actualizarEstado(mensaje, color = "black") {
    var btn = document.querySelector('button');
    if (btn) { btn.innerText = mensaje; btn.style.color = color; }
}

async function procesarAsistencia() {
    var dniInput = document.getElementById('dni').value.trim();
    var pinInput = document.getElementById('pin').value.trim();

    if (!dniInput || !pinInput) { alert("Complete DNI y PIN"); return; }

    actualizarEstado("⌛ Validando...", "blue");

    try {
        var hoy = obtenerFechaAR();
        
        // 1. LOGIN
        var resPers = await fetch(urlBase + "?sheet=Personal");
        var listaPersonal = await resPers.json();
        var usuario = listaPersonal.find(u => {
            var v = Object.values(u); 
            return String(v[0]).trim() === dniInput && String(v[2]).trim() === pinInput;
        });

        if (!usuario) { alert("DNI o PIN incorrectos."); actualizarEstado("Registrar Asistencia"); return; }
        
        var miNombreReal = String(usuario[Object.keys(usuario)[1]]).trim(); 
        actualizarEstado("✅ Hola " + miNombreReal, "green");

        // 2. BUSCAR MOVIMIENTOS
        var resMov = await fetch(urlBase + "/search?DNI=" + dniInput + "&sheet=Hoja 1");
        var movimientos = await resMov.json();
        
        // Buscamos el registro de HOY
        var registroHoy = movimientos.slice().reverse().find(f => f.Fecha === hoy);
        
        var etapa = 0; // Por defecto: Ingreso

        if (registroHoy) {
            // LÓGICA DE PRIORIDAD INVERSA (Crucial para que avance)
            if (registroHoy["Egreso"] && registroHoy["Egreso"] !== "") {
                alert("Jornada finalizada por hoy.");
                actualizarEstado("Registrar Asistencia");
                return;
            } 
            else if (registroHoy["Fin Pausa"] && registroHoy["Fin Pausa"] !== "") {
                etapa = 3; // Sigue: Egreso
            } 
            else if (registroHoy["Inicio Pausa"] && registroHoy["Inicio Pausa"] !== "") {
                etapa = 2; // Sigue: Fin Pausa
            } 
            else if (registroHoy["Ingreso"] && registroHoy["Ingreso"] !== "") {
                etapa = 1; // Sigue: Inicio Pausa
            }
        }

        // 3. DECIDIR ACCIÓN
        if (etapa === 0 || etapa === 3) {
            // Ingreso y Egreso son directos
            gestionarEnvio(dniInput, etapa, miNombreReal);
        } else {
            // Pausas requieren QR de Guardia
            alert("Paso: " + (etapa === 1 ? "Inicio Pausa" : "Fin Pausa") + ". Escanee QR.");
            iniciarEscaneo(dniInput, etapa, miNombreReal);
        }

    } catch (e) {
        alert("Error de conexión. Reintente.");
        actualizarEstado("Registrar Asistencia");
    }
}

// --- ESCANEO Y ENVÍO (Lógica optimizada) ---

function iniciarEscaneo(dniU, etapa, nombreU) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        async function(texto) {
            if (texto.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                zona.style.display = 'none';
                gestionarEnvio(dniU, etapa, nombreU);
            }
        }
    ).catch(() => alert("Error cámara"));
}

async function gestionarEnvio(dniU, etapa, nombreU) {
    var movs = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var columnaDestino = movs[etapa];

    // 1. OBTENER CONFIGURACIÓN DESDE EL EXCEL (Hoja 'config')
    actualizarEstado("📍 Validando ubicación...", "orange");
    var resConf = await fetch(urlBase + "?sheet=config");
    var config = await resConf.json();
    
    // Según tu foto: B2 es fila 1, B3 fila 2, B4 fila 3 (si no hay encabezados)
    // Pero si SheetDB detecta encabezados en la fila 1:
    var latPlanta = parseFloat(config[0].Valor); // Celda B2
    var lonPlanta = parseFloat(config[1].Valor); // Celda B3
    var radioMax  = parseFloat(config[2].Valor); // Celda B4 (Tu "1" o "200")

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var latUser = pos.coords.latitude;
        var lonUser = pos.coords.longitude;
        
        // 2. CALCULAR DISTANCIA (Fórmula Haversine)
        var R = 6371000; // Radio de la Tierra en metros
        var dLat = (latPlanta - latUser) * Math.PI / 180;
        var dLon = (lonPlanta - lonUser) * Math.PI / 180;
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(latUser * Math.PI / 180) * Math.cos(latPlanta * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        var distanciaReal = R * c;

        // 3. LA CONDICIÓN DE ORO (Aquí es donde el '1' o '200' del Excel manda)
        if (distanciaReal > radioMax) {
            alert("❌ FUERA DE RANGO. Estás a " + Math.round(distanciaReal) + " metros de la planta.");
            actualizarEstado("Registrar Asistencia");
            return; // CORTA EL ENVÍO, NO GUARDA NADA
        }

        // --- SI PASA LA VALIDACIÓN, SIGUE EL ENVÍO NORMAL ---
        var ahora = new Date();
        var fechaHoy = obtenerFechaAR();
        var horaActual = ahora.getHours().toString().padStart(2, '0') + ":" + ahora.getMinutes().toString().padStart(2, '0');
        var gps = latUser.toFixed(5) + "," + lonUser.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (etapa === 0) {
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=Hoja 1";
            bodyData.data = [{"Fecha": fechaHoy, "Nombre": nombreU, "DNI": dniU, "Ingreso": horaActual, "Distancia": gps}];
        } else {
            metodo = 'PATCH';
            urlFinal = urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=Hoja 1";
            bodyData.data[columnaDestino] = horaActual;
            bodyData.data["Distancia"] = gps;
        }

        try {
            var response = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            if (response.ok) {
                alert("¡Éxito! Distancia: " + Math.round(distanciaReal) + "m. " + columnaDestino + " registrado.");
                location.reload();
            }
        } catch (err) {
            alert("Error al guardar.");
        }
    }, () => alert("Active el GPS"), { enableHighAccuracy: true });
}
