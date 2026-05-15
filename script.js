// --- VARIABLES GLOBALES ---
var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';
var nombreHoja = 'Hoja%201'; // Cambiar a 'Hoja1' si no tiene espacio en tu Excel

/**
 * FUNCIÓN PARA MOSTRAR MENSAJES EN PANTALLA
 * Esta ayuda a que sepas qué está pasando sin usar tantos "alert" molestos.
 */
function actualizarEstado(mensaje, color = "black") {
    var statusDiv = document.getElementById('status-message');
    if (!statusDiv) {
        // Si no existe el elemento en tu HTML, lo crea dinámicamente
        statusDiv = document.createElement('div');
        statusDiv.id = 'status-message';
        statusDiv.style.fontWeight = 'bold';
        statusDiv.style.margin = '10px 0';
        document.body.insertBefore(statusDiv, document.getElementById('reader'));
    }
    statusDiv.innerText = mensaje;
    statusDiv.style.color = color;
}

/**
 * 1. FUNCIÓN PRINCIPAL: procesarAsistencia
 */
async function procesarAsistencia() {
    var dniVal = document.getElementById('dni').value;
    var pinVal = document.getElementById('pin').value;

    if (!dniVal || !pinVal) {
        alert("Complete DNI y PIN");
        return;
    }

    // --- EFECTO VISUAL: PROCESANDO ---
    actualizarEstado("🔍 Verificando estado en la planilla...", "blue");

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        
        // Consultamos la API
        var res = await fetch(urlBase + "/search?DNI=" + dniVal + "&sheet=" + nombreHoja);
        var datos = await res.json();
        
        var registroHoy = datos.find(fila => fila.Fecha === hoy);
        var nombreUsuario = (datos.length > 0) ? datos[0].Nombre : "USUARIO";

        var etapa = 0; 

        if (registroHoy) {
            if (registroHoy["Egreso"]) {
                actualizarEstado("✅ Jornada de hoy finalizada.", "green");
                return;
            } else if (registroHoy["Fin Pausa"]) {
                etapa = 3;
                actualizarEstado("🕒 Estado: Pendiente de Egreso", "orange");
            } else if (registroHoy["Inicio Pausa"]) {
                etapa = 2;
                actualizarEstado("🕒 Estado: En Pausa (Esperando Retorno)", "orange");
            } else if (registroHoy["Ingreso"]) {
                etapa = 1;
                actualizarEstado("🕒 Estado: Trabajando (Esperando Pausa)", "orange");
            }
        } else {
            actualizarEstado("🕒 Estado: Nuevo Registro de Ingreso", "orange");
        }

        // Lógica de acción
        if (etapa === 0 || etapa === 3) {
            gestionarEnvio(dniVal, etapa, nombreUsuario);
        } else {
            // Si es pausa, esperamos a que el usuario lea el QR
            actualizarEstado("📸 Esperando escaneo de QR Guardia...", "purple");
            iniciarEscaneo(dniVal, etapa, nombreUsuario);
        }
    } catch (e) {
        actualizarEstado("❌ Error de conexión", "red");
    }
}

/**
 * 2. FUNCIÓN DE ESCANEO
 */
function iniciarEscaneo(dniU, etapa, nombreU) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block';
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async function(texto) {
            if (texto.toUpperCase().includes("GUARDIA")) {
                actualizarEstado("🎯 QR Validado. Obteniendo GPS...", "blue");
                await html5QrCode.stop();
                zona.style.display = 'none';
                gestionarEnvio(dniU, etapa, nombreU);
            }
        }
    ).catch(err => actualizarEstado("❌ Error de cámara", "red"));
}

/**
 * 3. FUNCIÓN DE ENVÍO
 */
function gestionarEnvio(dniU, etapa, nombreU) {
    var columnas = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var mov = columnas[etapa];

    actualizarEstado("🛰️ Obteniendo ubicación GPS...", "blue");

    navigator.geolocation.getCurrentPosition(async function(pos) {
        actualizarEstado("⏳ Guardando " + mov + " en Cofarmen...", "blue");

        var ahora = new Date();
        var fechaHoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (etapa === 0) {
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=" + nombreHoja;
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": nombreU,
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
        } else {
            metodo = 'PATCH';
            urlFinal = urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=" + nombreHoja;
            bodyData.data[mov] = horaActual;
            bodyData.data["Distancia"] = gps;
        }

        try {
            var response = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                actualizarEstado("🎉 " + mov + " registrado con éxito.", "green");
                setTimeout(() => location.reload(), 2000); // Recarga tras 2 segundos para que veas el mensaje
            }
        } catch (err) {
            actualizarEstado("❌ Error al guardar", "red");
        }
    }, () => actualizarEstado("❌ Error: Active el GPS", "red"));
}
