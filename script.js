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
    var mov = "";
    if (cuenta === 0) mov = "Ingreso";
    else if (cuenta === 1) mov = "Inicio Pausa";
    else if (cuenta === 2) mov = "Fin Pausa";
    else if (cuenta === 3) mov = "Egreso";

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var hoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var coords = pos.coords.latitude.toFixed(4) + ", " + pos.coords.longitude.toFixed(4);
        
        var urlFinal = "";
        var metodo = "";
        var cuerpo = { "data": {} };

        if (cuenta === 0) {
            // POST: Crear fila nueva
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=" + nombreHoja;
            cuerpo.data = [{
                "Fecha": hoy,
                "Nombre": nombreU,
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": coords
            }];
        } else {
            // PATCH: Actualizar fila existente
            metodo = 'PATCH';
            // Filtramos por DNI y Fecha para asegurar que sea la fila de hoy
            urlFinal = urlBase + "/DNI/" + dniU + "?sheet=Hoja 1" + "&Fecha=" + hoy;
            cuerpo.data[mov] = horaActual;
            cuerpo.data["Distancia"] = coords;
        }

        try {
            var res = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cuerpo)
            });

            var resultadoTexto = await res.text();

            if (res.ok) {
                alert("REGISTRO EXITOSO: " + mov.toUpperCase());
                location.reload();
            } else {
                // Si la API rechaza el dato, nos dirá por qué (ej: columna no encontrada)
                alert("LA PLANILLA RECHAZÓ EL DATO: " + resultadoTexto);
            }
        } catch (e) {
            alert("ERROR DE RED: No se pudo llegar a la planilla.");
        }
    }, function() { alert("GPS OBLIGATORIO"); });
}
