var html5QrCode = null;
// API vinculada a tu planilla de Cofarmen
var urlAPI = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

async function procesarAsistencia() {
    var dniVal = document.getElementById('dni').value;
    var pinVal = document.getElementById('pin').value;

    if (!dniVal || !pinVal) {
        alert("Complete DNI y PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        // BUSQUEDA: Busca en la Hoja 1 usando la columna "DNI"
        var respuesta = await fetch(urlAPI + "/search?DNI=" + dniVal);
        var datos = await respuesta.json();
        
        // Filtra los registros de hoy usando la columna "Fecha"
        var registrosHoy = datos.filter(function(item) {
            return item["Fecha"] && item["Fecha"].includes(hoy);
        });

        var cantidad = registrosHoy.length;

        // LOGICA: 0 (Ingreso) y 3 (Egreso) son directos. 1 y 2 (Pausas) requieren QR.
        if (cantidad === 0 || cantidad === 3) {
            enviarDatosCofarmen(dniVal, cantidad);
        } else {
            alert("EL REGISTRO DE PAUSA REQUIERE ESCANEO EN GUARDIA");
            iniciarEscaneo(dniVal, cantidad);
        }
    } catch (error) {
        alert("ERROR DE CONEXIÓN CON LA HOJA 1");
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
    var mov = "";
    // Nombres de columna exactos según la imagen 1000330598.jpg
    if (cuenta === 0) mov = "Ingreso";
    else if (cuenta === 1) mov = "Inicio Pausa";
    else if (cuenta === 2) mov = "Fin Pausa";
    else if (cuenta === 3) mov = "Egreso";

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        // REGISTRO: Envía los datos para crear una nueva fila en la Hoja 1
        var fila = {
            "Fecha": ahora.toLocaleDateString('es-AR'),
            "Nombre": "PERSONAL PLANTA", // Aquí podrías vincular el nombre real si lo tenés
            "DNI": dniU,
            "Distancia": pos.coords.latitude + ", " + pos.coords.longitude
        };
        
        fila[mov] = ahora.toLocaleTimeString('es-AR');

        try {
            var res = await fetch(urlAPI, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ "data": [fila] })
            });

            if (res.ok) {
                alert("REGISTRO DE " + mov.toUpperCase() + " EXITOSO EN HOJA 1");
                location.reload();
            }
        } catch (e) { alert("ERROR AL GUARDAR"); }
    }, function() { alert("GPS OBLIGATORIO"); });
}
