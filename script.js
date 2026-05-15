// --- VARIABLES GLOBALES ---
var html5QrCode = null; // Guarda la instancia de la cámara
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm'; // Tu API principal
var nombreHoja = 'Hoja%201'; // "Hoja 1" con espacio codificado

/**
 * 1. FUNCIÓN PRINCIPAL: procesarAsistencia
 * Se ejecuta cuando tocás el botón de "Registrar" después de poner DNI/PIN.
 */
async function procesarAsistencia() {
    var dniVal = document.getElementById('dni').value;
    var pinVal = document.getElementById('pin').value;

    if (!dniVal || !pinVal) {
        alert("Falta DNI o PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        
        // Consultamos a la API qué registros existen para este DNI
        var res = await fetch(urlBase + "/search?DNI=" + dniVal + "&sheet=" + nombreHoja);
        var datos = await res.json();
        
        // Buscamos si existe la fila específica de hoy
        var registroHoy = datos.find(fila => fila.Fecha === hoy);
        
        // Obtenemos el nombre del primer registro que encuentre (para no tenerlo fijo en el código)
        var nombreUsuario = (datos.length > 0) ? datos[0].Nombre : "USUARIO NUEVO";

        var etapa = 0; // 0=Ingreso, 1=Inicio Pausa, 2=Fin Pausa, 3=Egreso

        // Lógica para decidir qué movimiento toca según qué celdas estén vacías
        if (registroHoy) {
            if (registroHoy["Egreso"]) {
                alert("Jornada terminada."); return;
            } else if (registroHoy["Fin Pausa"]) {
                etapa = 3; // Toca Egreso
            } else if (registroHoy["Inicio Pausa"]) {
                etapa = 2; // Toca Fin Pausa
            } else if (registroHoy["Ingreso"]) {
                etapa = 1; // Toca Inicio Pausa
            }
        }

        // Si es Ingreso (0) o Egreso (3) no pedimos QR (según tu lógica previa)
        // Si es Pausa (1 o 2) saltamos a la función de Escaneo
        if (etapa === 0 || etapa === 3) {
            gestionarEnvio(dniVal, etapa, nombreUsuario);
        } else {
            alert("VALIDACIÓN REQUERIDA EN GUARDIA");
            iniciarEscaneo(dniVal, etapa, nombreUsuario);
        }
    } catch (e) {
        alert("Error al sincronizar con la planilla.");
    }
}

/**
 * 2. FUNCIÓN DE ESCANEO: iniciarEscaneo
 * Activa la cámara y espera leer un QR que contenga la palabra "GUARDIA".
 */
function iniciarEscaneo(dniU, etapa, nombreU) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block'; // Muestra el cuadro de la cámara
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async function(texto) {
            if (texto.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop(); // Apaga la cámara
                zona.style.display = 'none'; // Esconde el cuadro
                gestionarEnvio(dniU, etapa, nombreU); // Pasa al envío de datos
            }
        }
    ).catch(err => alert("Error de cámara: " + err));
}

/**
 * 3. FUNCIÓN DE ENVÍO: gestionarEnvio
 * Obtiene el GPS y decide si crear una fila (POST) o actualizarla (PATCH).
 */
function gestionarEnvio(dniU, etapa, nombreU) {
    // Array para saber qué columna llenar según la etapa
    var columnas = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var mov = columnas[etapa];

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var fechaHoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (etapa === 0) {
            // Caso INGRESO: Se usa POST para crear la fila desde cero
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
            // Caso PAUSAS/EGRESO: Se usa PATCH para editar la fila de hoy
            metodo = 'PATCH';
            // Filtramos por DNI y Fecha para no pisar otros días
            urlFinal = urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=" + nombreHoja;
            bodyData.data[mov] = horaActual;
            bodyData.data["Distancia"] = gps;
        }

        // Enviamos la información a SheetDB
        try {
            var response = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                alert("REGISTRO DE " + mov.toUpperCase() + " EXITOSO");
                location.reload(); // Recarga la página para limpiar todo
            }
        } catch (err) {
            alert("Error de red al intentar guardar.");
        }
    }, () => alert("El GPS es obligatorio"));
}
