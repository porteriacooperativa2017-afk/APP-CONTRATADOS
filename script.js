var html5QrCode = null;
var urlAPI = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

async function procesarAsistencia() {
    var dni = document.getElementById('dni').value;
    var pin = document.getElementById('pin').value;

    if (!dni || !pin) {
        alert("Complete DNI y PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        // Buscamos por la columna exacta "dni" (en minúsculas según la planilla)
        var respuesta = await fetch(urlAPI + "/search?dni=" + dni);
        var datos = await respuesta.json();
        
        var registrosHoy = datos.filter(function(item) {
            return item["fecha y hora"] && item["fecha y hora"].includes(hoy);
        });

        var cantidad = registrosHoy.length;

        if (cantidad === 0 || cantidad === 3) {
            enviarDatosCofarmen(dni, cantidad);
        } else {
            alert("Acción protegida: Escanee el QR en Guardia");
            iniciarEscaneo(dni, cantidad);
        }
    } catch (error) {
        alert("Error de conexión con la planilla");
    }
}

function iniciarEscaneo(dniU, cuenta) {
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
                enviarDatosCofarmen(dniU, cuenta);
            }
        }
    ).catch(function(err) { alert("Error de cámara"); });
}

function enviarDatosCofarmen(dniU, cuenta) {
    var movimiento = "";
    // Nombres exactos de las columnas en tu Hoja 1
    if (cuenta === 0) movimiento = "ingreso";
    else if (cuenta === 1) movimiento = "inicio de pausa";
    else if (cuenta === 2) movimiento = "fin de pausa";
    else if (cuenta === 3) movimiento = "egreso";

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var fila = {
            "fecha y hora": ahora.toLocaleString('es-AR'),
            "dni": dniU,
            "nombre": "Personal Planta",
            "distancia": pos.coords.latitude + ", " + pos.coords.longitude
        };
        
        fila[movimiento] = ahora.toLocaleTimeString('es-AR');

        try {
            var res = await fetch(urlAPI, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ "data": [fila] })
            });

            if (res.ok) {
                alert("Registro de " + movimiento.toUpperCase() + " exitoso");
                location.reload();
            }
        } catch (e) { alert("Error al guardar"); }
    }, function() { alert("GPS obligatorio"); });
}
