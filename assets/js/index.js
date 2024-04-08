const cam = document.getElementById('cam')

/* Retorna uma lista de dispositivos */

/*const startVideo = () => {
    // Acesso a câmera default (padrão)
    navigator.getUserMedia(
        { audio: false, video: true }, 
        stream => cam.srcObject = stream,
        error => console.error(error)
      )
    /*navigator.mediaDevices.enumerateDevices().then(
        devices => {
            // Verifica se há uma lista de dispositivos
            if (Array.isArray(devices)) {
                // Percorre cada elemento da lista
                devices.forEach(device => {
                    // Consulta se o elemento encontrado é um dispositivo de vídeo
                    if (device.kind === 'videoinput'){
                        // Recupera um dispositivo pela label
                        if(device.label.includes('C270')){
                            navigator.getUserMedia(
                                {video: {
                                  deviceId: device.deviceId  
                                }},
                                // Retorna as propriedades de vídeo da câmera
                                stream => cam.srcObject = stream,
                                error => console.log(error)
                            )
                        }
                    }
                })
            }
        }
    )*/
//}


const startVideo = async () => {
    try {
        // Verifica se o navegador suporta o método getUserMedia
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
            cam.srcObject = stream;
        } else {
            // Se o navegador não suporta, mostra uma mensagem de erro
            console.error('O navegador não suporta getUserMedia');
        }
    } catch (error) {
        // Trata qualquer erro ocorrido durante a solicitação da câmera
        console.error('Erro ao acessar a câmera:', error);
    }
}

const loadLabels = () => {
    const labels = ['Kaik Bomfim']
    return Promise.all(labels.map(async label => {
        const descriptions = []
        for (let i = 1; i < 3; i++){
           const img = await faceapi.fetchImage(`./assets/lib/face-api/labels/${label}/${i}.jpg`)
           const detections = await faceapi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor()
            descriptions.push(detections.descriptor)
        }
        return new faceapi.LabeledFaceDescriptors(label, descriptions)
    }))
}

/* Importação das redes neurais do FaceAPI */

// Carrega todas as importações e inicializa a câmera
Promise.all(
    [
        faceapi.nets.tinyFaceDetector.loadFromUri('./assets/lib/face-api/models'), // Detecção de rostos
        faceapi.nets.faceLandmark68Net.loadFromUri('./assets/lib/face-api/models'), // Desenha traços
        faceapi.nets.faceRecognitionNet.loadFromUri('./assets/lib/face-api/models'), // Reconhecimento facial
        faceapi.nets.faceExpressionNet.loadFromUri('./assets/lib/face-api/models'), // Detecção de expressões
        faceapi.nets.ageGenderNet.loadFromUri('./assets/lib/face-api/models'), // Detecção de idade e gênero
        faceapi.nets.ssdMobilenetv1.loadFromUri('./assets/lib/face-api/models')
    ]
).then(startVideo)

// Adiciona eventos ao iniciar a câmera
cam.addEventListener('play', async () => {
    // Cria um canvas e define seu tamanho
    const canvas = faceapi.createCanvasFromMedia(cam)
    const canvasSize = {
        width: cam.width,
        height: cam.height
    }
    const labels = await loadLabels()
    faceapi.matchDimensions(canvas, canvasSize)
    document.body.appendChild(canvas)

    setInterval(async () => {
        // Uso da detecção facial
        const detections = await faceapi
            .detectAllFaces(
                cam, 
                new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender()
            .withFaceDescriptors()

        const resizedDetections = faceapi.resizeResults(detections, canvasSize)
        // Define uma porcentagem mínima para retorno das descrições
        const faceMatcher = new faceapi.FaceMatcher(labels, 0.6)
        const results = resizedDetections.map(d => 
            faceMatcher.findBestMatch(d.descriptor)
        )
        // Limpa o canvas de detecção
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
        // Desenha as detecções no canvas
        faceapi.draw.drawDetections(canvas, resizedDetections)
        // Desenha os landmarks (traços do rosto)
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
        // Exibe as expressões faciais
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections)
        
        // Cria uma função auxiliar para idade e gênero
        resizedDetections.forEach(detection => {
            const { age, gender, genderProbability } = detection
            new faceapi.draw.DrawTextField([
                `${parseInt(age, 10)} years`,
                `${gender} ${parseInt(genderProbability * 100, 10)}%`
            ], detection.detection.box.topRight).draw(canvas)
        })

        results.forEach((result, index) => {
            const box = resizedDetections[index].detection.box
            const { label, distance } = result
            new faceapi.draw.DrawTextField([
                `${label} ${parseInt(distance * 100, 10)}%`
            ], box.bottomRight).draw(canvas)
        })
    }, 100)
})

