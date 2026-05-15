var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

function actualizarEstado(mensaje, color = "black") {
    var btn = document.querySelector('button');
    if (btn) {
        btn.innerText = mensaje;
        btn.style.color = color;
    }
}

// --- FUNCIÓN 1: PROCESAR ASISTENCIA ---
async function procesarAsistencia() {
    var dniInput = document.getElementById('dni').value.trim();
    var pinInput = document.getElementById('pin').value.trim();

    if (!dniInput || !pinInput) {
        alert("Complete DNI y PIN");
        return;
    }

    actualizarEstado("⌛ Validando Identidad...", "blue");

    try {
        var resPers = await fetch(urlBase + "?sheet=Personal");
        var listaPersonal = await resPers.json();

        var usuario = listaPersonal.find(u => {
            var valores = Object.values(u); 
            return String(valores[0]).trim() === dniInput && String(valores[2]).trim() === pinInput;
        });

        if (!usuario) {
            alert("DNI o Contraseña incorrectos.");
            actualizarEstado("Registrar Asistencia");
            return;
        }

        // Agarramos el nombre de la Columna B de la hoja Personal
        var columnas = Object.keys(usuario);
        var miNombreReal = String(usuario[columnas[1]]).trim(); 
        
        actualizarEstado("✅ Hola " + miNombreReal, "green");

        var hoy = new Date().toLocaleDateString('es-AR');
        var resMov = await fetch(urlBase + "/search?DNI=" + dniInput + "&sheet=Hoja 1");
        var movimientos = await resMov.json();
        
        var registroHoy = movimientos.find(f => f.Fecha === hoy);
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
        alert("Error de conexión con la base de datos.");
        actualizarEstado("Registrar Asistencia");
    }
}

// --- FUNCIÓN 2: ESCANEO DE QR ---
function iniciarEscaneo(dniU, etapa, nombreU) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block';
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

// --- FUNCIÓN 3: ENVÍO A HOJA 1 (CORREGIDA PARA EL NOMBRE) ---
function gestionarEnvio(dniU, etapa, nombreU) {
    var movs = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var columnaDestino = movs[etapa];

    actualizarEstado("🛰️ Obteniendo GPS...", "blue");

    navigator.geolocation.getCurrentPosition(async function(pos) {
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
            
            // IMPORTANTE: Asegurate de que en tu Excel la celda B1 diga exactamente "Nombre"
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": nombreU, 
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
        } else {
            metodo = 'PATCH';
            urlFinal = urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=Hoja 1";
            bodyData.data[columnaDestino] = horaActual;
            // Al actualizar (PATCH), no solemos reenviar el nombre para no sobrecargar la fila,
            // pero si la fila ya tiene el nombre del paso 'Ingreso', no hace falta tocarlo.
            bodyData.data["Distancia"] = gps;
        }

        try {
            var response = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                alert("¡Éxito! " + columnaDestino + " registrado.");
                location.reload();
            }
        } catch (err) {
            alert("Error al guardar.");
            actualizarEstado("Registrar Asistencia");
        }
    }, () => alert("Active el GPS"));
}
