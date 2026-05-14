var html5QrCode = null;
// Codificación exacta: Hoja%201 para que SheetDB no se pierda
var urlAPI = 'https://sheetdb.io/api/v1/0r37mye22zrgm?sheet=Hoja%201';

async function procesarAsistencia() {
    var dniVal = document.getElementById('dni').value;
    var pinVal = document.getElementById('pin').value;

    if (!dniVal || !pinVal) {
        alert("Complete DNI y PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        // Buscamos específicamente en la Hoja 1
        var respuesta = await fetch(urlAPI + "&DNI=" + dniVal); 
        var datos = await respuesta.json();
        
        var registrosHoy = datos.filter(function(item) {
            return item["Fecha"] && item["Fecha"].includes(hoy);
        });

        var cantidad = registrosHoy.length;

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
    // Nombres exactos de la imagen 1000330598.jpg
    if (cuenta === 0) mov = "Ingreso";
    else if (cuenta === 1) mov = "Inicio Pausa";
    else if (cuenta === 2) mov = "Fin Pausa";
    else if (cuenta === 3) mov = "Egreso";

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        
        // Construcción del objeto con los nombres de la imagen 1000330598.jpg
        var registroFinal = {
            "Fecha": ahora.toLocaleDateString('es-AR'),
            "Nombre": "PERSONAL PLANTA", 
            "DNI": dniU,
            "Distancia": pos.coords.latitude.toFixed(6) + ", " + pos.coords.longitude.toFixed(6)
        };
        
        // Asignamos la hora a la columna correcta
        registroFinal[mov] = ahora.toLocaleTimeString('es-AR');

        try {
            var res = await fetch(urlAPI, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ "data": [registroFinal] })
            });

            if (res.ok) {
                alert("REGISTRO DE " + mov.toUpperCase() + " GUARDADO EXITOSAMENTE");
                location.reload();
            }
        } catch (e) { alert("ERROR AL GUARDAR"); }
    }, function() { alert("GPS OBLIGATORIO"); });
}
