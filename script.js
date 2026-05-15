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

    actualizarEstado("⌛ Conectando...", "blue");

    try {
        var hoy = obtenerFechaAR();
        
        // --- 1. CARGAR PERSONAL ---
        var resPers = await fetch(urlBase + "?sheet=Personal");
        if (!resPers.ok) throw new Error("Servidor Personal: " + resPers.status);
        var listaPersonal = await resPers.json();

        var usuario = listaPersonal.find(u => {
            var valores = Object.values(u); 
            return String(valores[0]).trim() === dniInput && String(valores[2]).trim() === pinInput;
        });

        if (!usuario) {
            alert("DNI o PIN incorrectos.");
            actualizarEstado("Registrar Asistencia");
            return;
        }

        var miNombreReal = String(usuario[Object.keys(usuario)[1]]).trim(); 
        actualizarEstado("✅ Hola " + miNombreReal, "green");

        // --- 2. BUSCAR MOVIMIENTOS ---
        var urlBusqueda = urlBase + "/search?DNI=" + dniInput + "&sheet=Hoja 1";
        var resMov = await fetch(urlBusqueda);
        if (!resMov.ok) throw new Error("Servidor Movimientos: " + resMov.status);
        var movimientos = await resMov.json();
        
        // Buscamos el último registro de hoy
        var registroHoy = movimientos.slice().reverse().find(f => f.Fecha === hoy);
        var etapa = 0; 

        if (registroHoy) {
            if (registroHoy["Egreso"]) {
                alert("Jornada finalizada.");
                actualizarEstado("Registrar Asistencia");
                return;
            } else if (registroHoy["Fin Pausa"]) {
                etapa = 3; 
            } else if (registroHoy["Inicio Pausa"]) {
                etapa = 2; 
            } else if (registroHoy["Ingreso"]) {
                etapa = 1; 
            }
        }

        if (etapa === 0 || etapa === 3) {
            gestionarEnvio(dniInput, etapa, miNombreReal);
        } else {
            alert("Validación de Guardia necesaria.");
            iniciarEscaneo(dniInput, etapa, miNombreReal);
        }

    } catch (e) {
        // ESTO TE VA A DECIR EL ERROR REAL
        alert("DETALLE DEL ERROR: " + e.message);
        actualizarEstado("Reintentar");
    }
}

// --- ESCANEO Y ENVÍO (IGUAL QUE ANTES PERO MÁS ROBUSTO) ---
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
    ).catch(() => alert("Error al encender cámara"));
}

function gestionarEnvio(dniU, etapa, nombreU) {
    var movs = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var columnaDestino = movs[etapa];

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var fechaHoy = obtenerFechaAR();
        var horaActual = ahora.getHours().toString().padStart(2, '0') + ":" + ahora.getMinutes().toString().padStart(2, '0');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

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
                alert("Registrado: " + columnaDestino);
                location.reload();
            } else {
                alert("Error servidor: " + response.status);
            }
        } catch (err) {
            alert("Sin conexión al servidor.");
        }
    }, () => alert("Active el GPS"), { enableHighAccuracy: true });
}
