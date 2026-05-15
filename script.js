// --- VARIABLES GLOBALES ---
var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

/**
 * FUNCIÓN DE ESTADO: Muestra mensajes para que sepas qué hace el sistema.
 */
function actualizarEstado(mensaje, color = "black") {
    var btn = document.querySelector('button');
    if (btn) {
        btn.innerText = mensaje;
        btn.style.color = color;
    }
}

/**
 * FUNCIÓN 1: PROCESAR ASISTENCIA (Login y Detección)
 * Entra primero a "Personal" para saber quién sos.
 */
async function procesarAsistencia() {
    var dniInput = document.getElementById('dni').value.trim();
    var pinInput = document.getElementById('pin').value.trim();

    if (!dniInput || !pinInput) {
        alert("Complete DNI y PIN");
        return;
    }

    actualizarEstado("⌛ Validando Identidad...", "blue");

    try {
        // --- PASO 1: LOGIN RIGUROSO ---
        // Traemos TODA la hoja Personal para buscarte ahí primero
        var resPers = await fetch(urlBase + "?sheet=Personal");
        var listaPersonal = await resPers.json();

        // Buscamos coincidencia exacta de DNI (Col A) y Contraseña (Col C)
        var usuario = listaPersonal.find(u => 
            String(u.DNI).trim() === dniInput && 
            String(u.contraseña).trim() === pinInput
        );

        if (!usuario) {
            alert("Acceso denegado: DNI o Contraseña incorrectos.");
            actualizarEstado("Registrar Asistencia");
            return;
        }

        // Si el login es correcto, guardamos tu nombre de la Columna B
        var miNombreReal = usuario["nombre completo"];
        actualizarEstado("✅ Hola " + miNombreReal, "green");

        // --- PASO 2: BUSCAR ESTADO EN HOJA 1 ---
        var hoy = new Date().toLocaleDateString('es-AR');
        var resMov = await fetch(urlBase + "/search?DNI=" + dniInput + "&sheet=Hoja 1");
        var movimientos = await resMov.json();
        
        var registroHoy = movimientos.find(f => f.Fecha === hoy);
        var etapa = 0; 

        if (registroHoy) {
            if (registroHoy["Egreso"]) {
                alert("Ya terminaste tu jornada de hoy.");
                actualizarEstado("Registrar Asistencia");
                return;
            } else if (registroHoy["Fin Pausa"]) {
                etapa = 3; // Sigue Egreso
            } else if (registroHoy["Inicio Pausa"]) {
                etapa = 2; // Sigue Fin Pausa
            } else if (registroHoy["Ingreso"]) {
                etapa = 1; // Sigue Inicio Pausa
            }
        }

        // --- PASO 3: ACCIÓN ---
        if (etapa === 0 || etapa === 3) {
            gestionarEnvio(dniInput, etapa, miNombreReal);
        } else {
            alert("Validación de Guardia necesaria para Pausa.");
            iniciarEscaneo(dniInput, etapa, miNombreReal);
        }

    } catch (e) {
        alert("Error de conexión con la base de datos.");
        actualizarEstado("Registrar Asistencia");
    }
}

/**
 * FUNCIÓN 2: ESCANEO DE QR
 */
function iniciarEscaneo(dniU, etapa, nombreU) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block';
    actualizarEstado("📸 Esperando QR Guardia...", "purple");

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async function(texto) {
            if (texto.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                zona.style.display = 'none';
                gestionarEnvio(dniU, etapa, nombreU);
            }
        }
    ).catch(err => actualizarEstado("Error Cámara", "red"));
}

/**
 * FUNCIÓN 3: ENVÍO DEFINITIVO A HOJA 1
 */
function gestionarEnvio(dniU, etapa, nombreU) {
    var movs = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var columnaDestino = movs[etapa];

    actualizarEstado("🛰️ Obteniendo GPS...", "blue");

    navigator.geolocation.getCurrentPosition(async function(pos) {
        actualizarEstado("⏳ Guardando " + columnaDestino + "...", "blue");

        var ahora = new Date();
        var fechaHoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (etapa === 0) {
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=Hoja 1";
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": nombreU, // USAMOS EL NOMBRE QUE TRAJIMOS DE 'PERSONAL'
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
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
                alert("Éxito: " + columnaDestino + " registrado.");
                location.reload();
            }
        } catch (err) {
            alert("Error al guardar.");
            actualizarEstado("Registrar Asistencia");
        }
    }, () => alert("GPS Obligatorio"));
}
