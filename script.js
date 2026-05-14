// Variable global para la cámara
var html5QrCode = null;
// Nueva API proporcionada por el usuario
var urlAPI = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

/**
 * Función principal activada al presionar "REGISTRAR ASISTENCIA"
 */
async function procesarAsistencia() {
    var dni = document.getElementById('dni').value;
    var pin = document.getElementById('pin').value;

    if (!dni || !pin) {
        alert("Por favor, ingrese su DNI y PIN.");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        // Consulta para verificar movimientos previos del día
        var respuesta = await fetch(urlAPI + "/search?dni=" + dni);
        var datos = await respuesta.json();
        
        var registrosHoy = datos.filter(function(item) {
            return item["fecha y hora"] && item["fecha y hora"].includes(hoy);
        });

        var cantidad = registrosHoy.length;

        // Lógica de validación: 0 (Ingreso) y 3 (Egreso) son directos. 
        // 1 (Inicio Pausa) y 2 (Fin Pausa) requieren QR.
        if (cantidad === 0 || cantidad === 3) {
            enviarDatosCofarmen(dni, cantidad);
        } else {
            alert("El registro de pausa requiere escaneo en Guardia.");
            iniciarEscaneoSeguro(dni, cantidad);
        }
    } catch (error) {
        console.error(error);
        alert("Error de conexión con la planilla. Verifique su señal en planta.");
    }
}

/**
 * Activa el escaneo QR solo para las pausas
 */
function iniciarEscaneoSeguro(dniU, cuenta) {
    var zonaLector = document.getElementById('reader');
    zonaLector.style.display = 'block';
    
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async function(resultadoQR) {
            // Validamos que sea el código de la guardia de Cofarmen
            if (resultadoQR.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                zonaLector.style.display = 'none';
                enviarDatosCofarmen(dniU, cuenta);
            }
        },
        function(error) { /* Escaneo en curso... */ }
    ).catch(function(err) {
        alert("Error al abrir la cámara: " + err);
    });
}

/**
 * Envío final de datos a la Hoja 1
 */
function enviarDatosCofarmen(dniU, cuenta) {
    var columnaMovimiento = "";
    if (cuenta === 0) columnaMovimiento = "ingreso";
    else if (cuenta === 1) columnaMovimiento = "inicio de pausa";
    else if (cuenta === 2) columnaMovimiento = "fin de pausa";
    else if (cuenta === 3) columnaMovimiento = "egreso";

    navigator.geolocation.getCurrentPosition(async function(posicion) {
        var ahora = new Date();
        var localizacion = posicion.coords.latitude + ", " + posicion.coords.longitude;
        
        var registro = {
            "fecha y hora": ahora.toLocaleString('es-AR'),
            "dni": dniU,
            "nombre": "Personal Planta",
            "distancia": localizacion
        };
        
        // Asignamos la hora al movimiento correspondiente
        registro[columnaMovimiento] = ahora.toLocaleTimeString('es-AR');

        try {
            var postEnvio = await fetch(urlAPI, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ "data": [registro] })
            });

            if (postEnvio.ok) {
                alert("Registro de " + columnaMovimiento.toUpperCase() + " realizado con éxito.");
                location.reload();
            }
        } catch (e) {
            alert("Error al guardar los datos en la planilla.");
        }
    }, function() {
        alert("El GPS debe estar activo para validar la ubicación en Mendoza.");
    });
}
