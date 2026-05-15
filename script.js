// --- VARIABLES GLOBALES ---
var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

/**
 * FUNCIÓN DE ESTADO: Actualiza el texto del botón principal.
 */
function actualizarEstado(mensaje, color = "black") {
    var btn = document.querySelector('button');
    if (btn) {
        btn.innerText = mensaje;
        btn.style.color = color;
    }
}

/**
 * FUNCIÓN 1: PROCESAR ASISTENCIA (Login y Detección de Etapa)
 */
async function procesarAsistencia() {
    var dniInput = document.getElementById('dni').value.trim();
    var pinInput = document.getElementById('pin').value.trim();

    if (!dniInput || !pinInput) {
        alert("Complete DNI y PIN");
        return;
    }

    actualizarEstado("⌛ Validando...", "blue");

    try {
        // --- PASO 1: LOGIN (Con Cache-Busting para APK) ---
        var resPers = await fetch(urlBase + "?sheet=Personal&v=" + new Date().getTime());
        var listaPersonal = await resPers.json();

        var usuario = listaPersonal.find(u => {
            var valores = Object.values(u); 
            return String(valores[0]).trim() === dniInput && String(valores[2]).trim() === pinInput;
        });

        if (!usuario) {
            alert("Acceso denegado: Credenciales incorrectas.");
            actualizarEstado("Registrar Asistencia");
            return;
        }

        // Obtenemos el nombre real (Columna B de la hoja Personal)
        var columnas = Object.keys(usuario);
        var miNombreReal = String(usuario[columnas[1]]).trim(); 
        
        actualizarEstado("✅ Hola " + miNombreReal, "green");

        // --- PASO 2: DETECTAR MOVIMIENTO DEL DÍA (Con Cache-Busting) ---
        var hoy = new Date().toLocaleDateString('es-AR');
        var urlBusqueda = urlBase + "/search?DNI=" + dniInput + "&sheet=Hoja 1&v=" + new Date().getTime();
        
        var resMov = await fetch(urlBusqueda);
        var movimientos = await resMov.json();
        
        var registroHoy = movimientos.find(f => f.Fecha === hoy);
        var etapa = 0; // 0=Ingreso, 1=Inicio Pausa, 2=Fin Pausa, 3=Egreso

        if (registroHoy) {
            // Lógica inversa para detectar el último movimiento real
            if (registroHoy["Egreso"]) {
                alert("Jornada finalizada por hoy.");
                actualizarEstado("Registrar Asistencia");
                return;
            } else if (registroHoy["Fin Pausa"]) {
                etapa = 3; // Sigue: Egreso
            } else if (registroHoy["Inicio Pausa"]) {
                etapa = 2; // Sigue: Fin Pausa
            } else if (registroHoy["Ingreso"]) {
                etapa = 1; // Sigue: Inicio Pausa
            }
        }

        // --- PASO 3: DECIDIR ACCIÓN ---
        // Ingreso (0) y Egreso (3) son directos. Pausas (1 y 2) requieren QR de Guardia.
        if (etapa === 0 || etapa === 3) {
            gestionarEnvio(dniInput, etapa, miNombreReal);
        } else {
            alert("Validación de Guardia necesaria para la Pausa.");
            iniciarEscaneo(dniInput, etapa, miNombreReal);
        }

    } catch (e) {
        alert("Error de conexión. Verifique su internet.");
        actualizarEstado("Registrar Asistencia");
    }
}

/**
 * FUNCIÓN 2: ESCANEO DE QR (Cámara)
 */
function iniciarEscaneo(dniU, etapa, nombreU) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async function(texto) {
            // El QR debe contener la palabra "GUARDIA"
            if (texto.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                zona.style.display = 'none';
                gestionarEnvio(dniU, etapa, nombreU);
            }
        }
    ).catch(err => {
        alert("Error al abrir la cámara.");
        actualizarEstado("Registrar Asistencia");
    });
}

/**
 * FUNCIÓN 3: ENVÍO DEFINITIVO A GOOGLE SHEETS
 */
function gestionarEnvio(dniU, etapa, nombreU) {
    var movs = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var columnaDestino = movs[etapa];

    actualizarEstado("🛰️ Obteniendo GPS...", "blue");

    navigator.geolocation.getCurrentPosition(async function(pos) {
        actualizarEstado("⏳ Guardando...", "blue");

        var ahora = new Date();
        var fechaHoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (etapa === 0) {
            // Nuevo registro (POST)
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=Hoja 1";
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": nombreU, 
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
        } else {
            // Actualizar registro existente (PATCH)
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
                alert("¡Éxito! " + columnaDestino + " registrado correctamente.");
                location.reload(); // Recarga para limpiar datos
            } else {
                throw new Error("Error en respuesta de servidor");
            }
        } catch (err) {
            alert("Error al guardar en la planilla. Intente de nuevo.");
            actualizarEstado("Registrar Asistencia");
        }
    }, () => {
        alert("Debe activar el GPS para registrar su asistencia.");
        actualizarEstado("Registrar Asistencia");
    }, { enableHighAccuracy: true });
}
