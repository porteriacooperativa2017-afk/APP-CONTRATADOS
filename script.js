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
        
        // Simplificamos la búsqueda para evitar el "Error de conexión"
        // Buscamos en Hoja 1 los registros de este DNI
        var res = await fetch(urlBase + "/search?DNI=" + dniVal + "&sheet=Hoja 1");
        var datos = await res.json();
        
        // Filtramos manualmente los de hoy para mayor seguridad
        var registrosHoy = datos.filter(function(fila) {
            return fila.Fecha === hoy;
        });
        
        var cantidad = registrosHoy.length;

        // Si no hay nada hoy (Ingreso) o ya hay 3 (Egreso), va directo.
        // Si hay 1 o 2, es Pausa y pide QR.
        if (cantidad === 0 || cantidad === 3) {
            gestionarEnvio(dniVal, cantidad);
        } else {
            alert("REGISTRO DE PAUSA: ESCANEE QR DE GUARDIA");
            iniciarEscaneo(dniVal, cantidad);
        }
    } catch (e) {
        alert("ERROR DE SINCRONIZACIÓN: Reintente en un instante.");
        console.log(e);
    }
}

function iniciarEscaneo(dniU, cuenta) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block';
    
    // Si ya había una instancia, la limpiamos para evitar errores
    if (html5QrCode) {
        html5QrCode.clear();
    }
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async function(texto) {
            // Validamos que el QR sea el correcto
            if (texto.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                zona.style.display = 'none';
                gestionarEnvio(dniU, cuenta);
            }
        }
    ).catch(function(err) { 
        alert("ERROR DE CÁMARA: Asegúrese de dar permisos."); 
    });
}

function gestionarEnvio(dniU, cuenta) {
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
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=Hoja 1";
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": "Diego Olivares",
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
        } else {
            metodo = 'PATCH';
            // Para la pausa/egreso, filtramos por DNI y Fecha en Hoja 1
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
                alert("REGISTRO EXITOSO: " + mov.toUpperCase());
                location.reload();
            } else {
                alert("LA PLANILLA NO RESPONDE. REINTENTE.");
            }
        } catch (err) {
            alert("ERROR DE RED AL GUARDAR");
        }
    }, function() { 
        alert("EL GPS ES NECESARIO PARA MARCAR"); 
    });
}
