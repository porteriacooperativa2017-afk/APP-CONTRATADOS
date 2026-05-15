var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';
var nombreHoja = 'Hoja%201'; 

// Función para cambiar el texto del botón y dar feedback
function botonCargando(estado) {
    var btn = document.querySelector('button'); // Busca tu botón de registro
    if (estado) {
        btn.disabled = true;
        btn.innerText = "⌛ Procesando...";
    } else {
        btn.disabled = false;
        btn.innerText = "Registrar Asistencia";
    }
}

async function procesarAsistencia() {
    var dniVal = document.getElementById('dni').value;
    var pinVal = document.getElementById('pin').value;

    if (!dniVal || !pinVal) {
        alert("Complete DNI y PIN");
        return;
    }

    // Iniciamos feedback
    botonCargando(true);

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        
        // Buscamos datos (respetando tu lógica que funcionaba)
        var res = await fetch(urlBase + "/search?DNI=" + dniVal + "&sheet=" + nombreHoja);
        var datos = await res.json();
        
        var registroHoy = datos.find(f => f.Fecha === hoy);
        
        // MEJORA: Nombre dinámico desde la base de datos
        var nombreUsuario = (datos.length > 0) ? datos[0].Nombre : "Diego Olivares";

        var etapa = 0; 

        if (registroHoy) {
            if (registroHoy["Egreso"]) {
                alert("Jornada finalizada");
                botonCargando(false);
                return;
            } else if (registroHoy["Fin Pausa"]) {
                etapa = 3;
            } else if (registroHoy["Inicio Pausa"]) {
                etapa = 2;
            } else if (registroHoy["Ingreso"]) {
                etapa = 1;
            }
        }

        if (etapa === 0 || etapa === 3) {
            gestionarEnvio(dniVal, etapa, nombreUsuario);
        } else {
            // Si es pausa, avisamos antes de abrir cámara
            alert("Etapa detectada: " + (etapa === 1 ? "Inicio Pausa" : "Fin Pausa") + ". Prepare el QR de Guardia.");
            iniciarEscaneo(dniVal, etapa, nombreUsuario);
        }
    } catch (e) {
        alert("Error de conexión");
        botonCargando(false);
    }
}

function iniciarEscaneo(dniU, etapa, nombreU) {
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
                gestionarEnvio(dniU, etapa, nombreU);
            }
        }
    ).catch(err => {
        alert("Error de cámara");
        botonCargando(false);
    });
}

function gestionarEnvio(dniU, etapa, nombreU) {
    var columnas = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var mov = columnas[etapa];

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var fechaHoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (etapa === 0) {
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=" + nombreHoja;
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": nombreU,
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
        } else {
            metodo = 'PATCH';
            urlFinal = urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=" + nombreHoja;
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
                alert("ÉXITO: " + mov + " registrado correctamente.");
                location.reload();
            }
        } catch (err) {
            alert("Error al guardar");
            botonCargando(false);
        }
    }, function() {
        alert("GPS no detectado");
        botonCargando(false);
    });
}
