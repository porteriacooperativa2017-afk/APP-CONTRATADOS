var html5QrCode = null;
// Cuando migres a Google Apps Script, cambiás esta URL por la tuya que termina en /exec
var urlBase = 'https://sheetdb.io/api/v1/7hbqbid7qazzj'; 

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
        
        var etapa = 0; // Por defecto: Ingreso (Columna D)

        if (registroHoy) {
            // LÓGICA DE PRIORIDAD INVERSA EXTENDIDA A 2 PAUSAS
            if (registroHoy["Egreso"] && registroHoy["Egreso"] !== "") {
                alert("Jornada finalizada por hoy.");
                actualizarEstado("Registrar Asistencia");
                return;
            } 
            else if (registroHoy["Fin Pausa 2"] && registroHoy["Fin Pausa 2"] !== "") {
                etapa = 5; // Sigue: Egreso
            }
            else if (registroHoy["Inicio Pausa 2"] && registroHoy["Inicio Pausa 2"] !== "") {
                etapa = 4; // Sigue: Fin Pausa 2
            }
            else if (registroHoy["Fin Pausa 1"] && registroHoy["Fin Pausa 1"] !== "") {
                // Alerta informativa del límite de tiempo acumulado
                alert("Ya utilizaste la primera pausa. Recordá que el total disponible es de 30 minutos.");
                etapa = 3; // Sigue: Inicio Pausa 2
            } 
            else if (registroHoy["Inicio Pausa 1"] && registroHoy["Inicio Pausa 1"] !== "") {
                etapa = 2; // Sigue: Fin Pausa 1
            } 
            else if (registroHoy["Ingreso"] && registroHoy["Ingreso"] !== "") {
                etapa = 1; // Sigue: Inicio Pausa 1
            }
        }

        // 3. DECIDIR ACCIÓN
        // Las etapas de Pausas (1, 2, 3, 4) requieren el QR del Guardia. 
        // Ingreso (0) y Egreso (5) son directos sin QR de portería.
        if (etapa === 0 || etapa === 5) {
            gestionarEnvio(dniInput, etapa, miNombreReal);
        } else {
            var nombresEtapas = ["", "Inicio Pausa 1", "Fin Pausa 1", "Inicio Pausa 2", "Fin Pausa 2"];
            alert("Paso: " + nombresEtapas[etapa] + ". Escanee el QR de Portería.");
            iniciarEscaneo(dniInput, etapa, miNombreReal);
        }

    } catch (e) {
        alert("Error de conexión. Reintente.");
        actualizarEstado("Registrar Asistencia");
    }
}

// --- ESCANEO Y ENVÍO ---

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

function gestionarEnvio(dniU, etapa, nombreU) {
    // Mapeo exacto con los nombres de tus columnas en la "Hoja 1"
    var movs = ["Ingreso", "Inicio Pausa 1", "Fin Pausa 1", "Inicio Pausa 2", "Fin Pausa 2", "Egreso"];
    var columnaDestino = movs[etapa];

    actualizarEstado("📍 Validando...", "orange");

    // COORDENADAS FIJAS (Planta)
    var latPlanta = -32.940227; 
    var lonPlanta = -68.761023; 
    var radioMaximo = 200; 

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var latUser = pos.coords.latitude;
        var lonUser = pos.coords.longitude;

        // CÁLCULO DE DISTANCIA
        var R = 6371000; 
        var dLat = (latPlanta - latUser) * Math.PI / 180;
        var dLon = (lonPlanta - lonUser) * Math.PI / 180;
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(latUser * Math.PI / 180) * Math.cos(latPlanta * Math.PI / 180) *
                Math.sin(dLon/2) * dLon/2;
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        var distanciaReal = R * c;

        if (distanciaReal > radioMaximo) {
            alert("❌ FUERA DE RANGO: Estás a " + Math.round(distanciaReal) + "m.");
            actualizarEstado("Registrar Asistencia");
            return; 
        }

        var ahora = new Date();
        var fechaHoy = obtenerFechaAR();
        var horaActual = ahora.getHours().toString().padStart(2, '0') + ":" + ahora.getMinutes().toString().padStart(2, '0');
        var gps = latUser.toFixed(5) + "," + lonUser.toFixed(5);

        // Si es etapa 0 (Ingreso) hace POST, sino hace PATCH apuntando a la fila del DNI y Fecha de hoy
        var urlFinal = (etapa === 0) ? urlBase + "?sheet=Hoja 1" : urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=Hoja 1";
        var metodo = (etapa === 0) ? 'POST' : 'PATCH';
        
        var bodyData = { "data": (etapa === 0) ? [{"Fecha": fechaHoy, "Nombre": nombreU, "DNI": dniU, "Ingreso": horaActual, "Distancia": gps}] : {} };
        if (etapa !== 0) bodyData.data[columnaDestino] = horaActual;

        try {
            var response = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                alert("✅ ¡Éxito! " + columnaDestino + " registrado correctamente.");
                location.reload();
            } else if (response.status === 429) {
                alert("⚠️ Error: Límite de API de SheetDB alcanzado.");
            }
        } catch (err) {
            alert("❌ Error de red o conexión.");
        }
    }, () => alert("Active el GPS"), { enableHighAccuracy: true });
}
