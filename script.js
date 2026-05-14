// Variable para el control de la cámara
var html5QrCode = null;
var urlAPI = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

// 1. Función principal del botón
async function procesarAsistencia() {
    var dni = document.getElementById('dni').value;
    var pin = document.getElementById('pin').value;

    if (!dni || !pin) {
        alert("Complete DNI y PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        var respuesta = await fetch(urlAPI + "/search?dni=" + dni);
        var datos = await respuesta.json();
        
        // Filtrar registros del día
        var registrosHoy = datos.filter(function(item) {
            return item["fecha y hora"] && item["fecha y hora"].includes(hoy);
        });

        var cantidad = registrosHoy.length;

        // Lógica: 0 (Ingreso) y 3 (Egreso) son directos. 1 y 2 (Pausas) piden QR.
        if (cantidad === 0 || cantidad === 3) {
            enviarDatosAlServidor(dni, cantidad);
        } else {
            alert("Esta acción requiere escaneo de QR en Guardia");
            iniciarCamaraQR(dni, cantidad);
        }
    } catch (error) {
        alert("Error de conexión con la planilla");
    }
}

// 2. Función para activar la cámara
function iniciarCamaraQR(dniU, cuenta) {
    var zonaLectura = document.getElementById('reader');
    zonaLectura.style.display = 'block';
    
    html5QrCode = new Html5Qrcode("reader");
    
    var configuracion = { fps: 10, qrbox: 250 };
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        configuracion,
        async function(textoQR) {
            if (textoQR.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                zonaLectura.style.display = 'none';
                enviarDatosAlServidor(dniU, cuenta);
            }
        },
        function(error) { /* Escaneando... */ }
    ).catch(function(err) {
        alert("No se pudo iniciar la cámara: " + err);
    });
}

// 3. Función de envío final a la Hoja 1
function enviarDatosAlServidor(dniU, cuenta) {
    var movimiento = "";
    if (cuenta === 0) movimiento = "ingreso";
    else if (cuenta === 1) movimiento = "inicio de pausa";
    else if (cuenta === 2) movimiento = "fin de pausa";
    else if (cuenta === 3) movimiento = "egreso";

    navigator.geolocation.getCurrentPosition(async function(posicion) {
        var ahora = new Date();
        var coordenadas = posicion.coords.latitude + ", " + posicion.coords.longitude;
        
        // Construcción del objeto de datos
        var fila = {
            "fecha y hora": ahora.toLocaleString('es-AR'),
            "dni": dniU,
            "nombre": "Personal Planta",
            "distancia": coordenadas
        };
        
        // Asignar el tiempo al movimiento que corresponde
        fila[movimiento] = ahora.toLocaleTimeString('es-AR');

        try {
            var postRes = await fetch(urlAPI, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ "data": [fila] })
            });

            if (postRes.ok) {
                alert("Registro de " + movimiento.toUpperCase() + " completado");
                location.reload();
            }
        } catch (err) {
            alert("Error al guardar en la hoja de MOVIMIENTOS");
        }
    }, function() {
        alert("El GPS es obligatorio para el registro");
    });
}
