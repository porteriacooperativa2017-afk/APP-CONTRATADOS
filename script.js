var html5QrCode = null;
var urlAPI = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

async function procesarAsistencia() {
    var dniInput = document.getElementById('dni').value;
    var pinInput = document.getElementById('pin').value;

    if (!dniInput || !pinInput) {
        alert("Complete DNI y PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        // Buscamos usando "DNI" exactamente como está en la foto
        var respuesta = await fetch(urlAPI + "/search?DNI=" + dniInput);
        var datos = await respuesta.json();
        
        // Filtramos por la columna "Fecha" (primera en mayúscula)
        var registrosHoy = datos.filter(function(item) {
            return item["Fecha"] && item["Fecha"].includes(hoy);
        });

        var cantidad = registrosHoy.length;

        if (cantidad === 0 || cantidad === 3) {
            enviarDatosCofarmen(dniInput, cantidad);
        } else {
            alert("EL REGISTRO DE PAUSA REQUIERE ESCANEO EN GUARDIA");
            iniciarEscaneo(dniInput, cantidad);
        }
    } catch (error) {
        alert("ERROR DE CONEXIÓN CON LA PLANILLA");
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
    ).catch(function(err) { alert("ERROR DE CÁMARA"); });
}

function enviarDatosCofarmen(dniU, cuenta) {
    var movimiento = "";
    // Nombres exactos según la foto 1000330598.jpg
    if (cuenta === 0) movimiento = "Ingreso";
    else if (cuenta === 1) movimiento = "Inicio Pausa";
    else if (cuenta === 2) movimiento = "Fin Pausa";
    else if (cuenta === 3) movimiento = "Egreso";

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var fila = {
            "Fecha": ahora.toLocaleDateString('es-AR'),
            "Nombre": "Personal Planta",
            "DNI": dniU,
            "Distancia": pos.coords.latitude + ", " + pos.coords.longitude
        };
        
        fila[movimiento] = ahora.toLocaleTimeString('es-AR');

        try {
            var res = await fetch(urlAPI, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ "data": [fila] })
            });

            if (res.ok) {
                alert("REGISTRO DE " + movimiento.toUpperCase() + " EXITOSO");
                location.reload();
            }
        } catch (e) { alert("ERROR AL GUARDAR"); }
    }, function() { alert("GPS OBLIGATORIO"); });
}
