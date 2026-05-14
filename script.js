var html5QrCode = null;
// Esta es la API que vinculaste a tu planilla
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm'; 
// Parámetro vital para que SheetDB use la pestaña correcta
var urlAPI = urlBase + '?sheet=Hoja%201';

async function procesarAsistencia() {
    var dniVal = document.getElementById('dni').value;
    var pinVal = document.getElementById('pin').value;

    if (!dniVal || !pinVal) {
        alert("Complete DNI y PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        // BUSQUEDA: Forzamos la búsqueda en Hoja 1 filtrando por DNI y Fecha
        var respuesta = await fetch(urlAPI + "&DNI=" + dniVal + "&Fecha=" + hoy); 
        var datos = await respuesta.json();
        
        var cantidad = datos.length;

        // Si no hay registros hoy (0) o ya terminó el turno (4), va directo
        // Si hay entre 1 y 3 movimientos, requiere validar en Guardia
        if (cantidad === 0 || cantidad === 4) {
            gestionarEnvio(dniVal, cantidad);
        } else {
            alert("VALIDACIÓN REQUERIDA: ESCANEE EL QR DE GUARDIA");
            iniciarEscaneo(dniVal, cantidad);
        }
    } catch (error) {
        alert("ERROR DE CONEXIÓN: Verifique el estado de la API");
    }
}

function gestionarEnvio(dniU, cuenta) {
    var mov = "";
    // Nombres exactos según tu foto de la tabla verde
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
            // PRIMER REGISTRO: Crea la fila en Hoja 1
            var registro = {
                "data": [{
                    "Fecha": hoy,
                    "Nombre": "Diego Olivares",
                    "DNI": dniU,
                    "Ingreso": horaActual,
                    "Distancia": coords
                }]
            };
            ejecutarFetch(urlAPI, 'POST', registro);
        } else {
            // ACTUALIZACIÓN: Busca la fila de HOY y completa el campo vacío
            // El filtro por Fecha es CLAVE para que no cree fila nueva
            var urlUpdate = urlBase + "/DNI/" + dniU + "?sheet=Hoja%201&Fecha=" + hoy;
            var actualizacion = { "data": {} };
            actualizacion.data[mov] = horaActual;
            actualizacion.data["Distancia"] = coords;
            
            ejecutarFetch(urlUpdate, 'PATCH', actualizacion);
        }
    }, function() { alert("EL GPS ES OBLIGATORIO"); });
}

async function ejecutarFetch(url, metodo, cuerpo) {
    try {
        var res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        if (res.ok) {
            alert("REGISTRO EXITOSO EN HOJA 1");
            location.reload();
        }
    } catch (e) { alert("ERROR AL GUARDAR"); }
}

function iniciarEscaneo(dniU, cuenta) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        async function(texto) {
            if (texto.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                zona.style.display = 'none';
                gestionarEnvio(dniU, cuenta);
            }
        }
    ).catch(function(err) { alert("ERROR DE CÁMARA"); });
}
