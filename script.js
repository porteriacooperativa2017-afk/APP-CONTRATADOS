var html5QrCode = null;
// Usamos la pestaña Hoja 1 y codificamos el espacio
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
        // Buscamos registros previos de hoy para este DNI
        var respuesta = await fetch(urlAPI + "&DNI=" + dniVal + "&Fecha=" + hoy); 
        var datos = await respuesta.json();
        
        var cantidad = datos.length;

        // 0=Ingreso, 1=Inicio Pausa, 2=Fin Pausa, 3=Egreso
        if (cantidad === 0 || cantidad === 3) {
            gestionarEnvio(dniVal, cantidad);
        } else {
            alert("VALIDACIÓN EN GUARDIA REQUERIDA");
            iniciarEscaneo(dniVal, cantidad);
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
                gestionarEnvio(dniU, cuenta);
            }
        }
    ).catch(function(err) { alert("ERROR DE CÁMARA"); });
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
        
        if (cuenta === 0) {
            // INGRESO: Crea la fila inicial del día
            var nuevoRegistro = {
                "data": [{
                    "Fecha": hoy,
                    "Nombre": "Diego Olivares",
                    "DNI": dniU,
                    "Ingreso": horaActual,
                    "Distancia": coords
                }]
            };
            ejecutarFetch(urlAPI, 'POST', nuevoRegistro);
        } else {
            // PAUSAS Y EGRESO: Actualiza la fila existente de hoy
            // Filtramos por DNI y por Fecha para que no cree una fila nueva
            var urlUpdate = urlAPI + "/DNI/" + dniU + "?Fecha=" + hoy;
            var actualizacion = {
                "data": {}
            };
            actualizacion.data[mov] = horaActual;
            actualizacion.data["Distancia"] = coords;
            
            ejecutarFetch(urlUpdate, 'PATCH', actualizacion);
        }
    }, function() { alert("GPS OBLIGATORIO"); });
}

async function ejecutarFetch(url, metodo, cuerpo) {
    try {
        var res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        if (res.ok) {
            alert("REGISTRO ACTUALIZADO CORRECTAMENTE");
            location.reload();
        }
    } catch (e) { alert("ERROR AL GUARDAR"); }
}
