var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

async function procesarAsistencia() {
    var dniVal = document.getElementById('dni').value;
    var pinVal = document.getElementById('pin').value;

    if (!dniVal || !pinVal) {
        alert("Falta DNI o PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        
        // BUSQUEDA FORZADA: Le decimos explícitamente que mire la Hoja 1
        var res = await fetch(urlBase + "/search?DNI=" + dniVal + "&Fecha=" + hoy + "&sheet=Hoja 1");
        var datos = await res.json();
        
        var cantidad = datos.length;

        if (cantidad === 0 || cantidad === 3) {
            gestionarEnvio(dniVal, cantidad);
        } else {
            alert("ESCANEE QR EN GUARDIA");
            iniciarEscaneo(dniVal, cantidad);
        }
    } catch (e) {
        alert("Error de conexión");
    }
}

function gestionarEnvio(dniU, cuenta) {
    // Nombres extraídos EXACTAMENTE de tu foto 1000330598.jpg
    var mov = (cuenta === 0) ? "Ingreso" : (cuenta === 1) ? "Inicio Pausa" : (cuenta === 2) ? "Fin Pausa" : "Egreso";

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var fechaHoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (cuenta === 0) {
            // POST: Creamos la fila
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=Hoja 1";
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": "Diego Olivares", // Tu nombre según sistema
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
        } else {
            // PATCH: Actualizamos la fila de hoy
            metodo = 'PATCH';
            // Esta es la ruta que SheetDB exige para no fallar:
            urlFinal = urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=Hoja 1";
            bodyData.data[mov] = horaActual;
            bodyData.data["Distancia"] = gps;
        }

        try {
            var response = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                alert("GUARDADO EXITOSO EN HOJA 1: " + mov);
                location.reload();
            } else {
                alert("Error: La planilla no aceptó el dato.");
            }
        } catch (err) {
            alert("Error de red");
        }
    });
}
