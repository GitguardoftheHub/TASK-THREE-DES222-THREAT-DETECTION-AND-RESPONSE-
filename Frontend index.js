// hard-code the backend server
let backendURL = 'https://image-analysis-server-weld.vercel.app'

//-----  Code for accessing the camera -----//
let width = 320;    // We will scale the photo width to this
let height = 0;     // This will be computed based on the input stream
let streaming = false;
let videoAspectRatio = 1.6;
let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let output = document.getElementById('photoFrame');
let photo = document.getElementById('photo');
let requestButton = document.getElementById('requestButton');
let takePhotoButton = document.getElementById('takePhotoButton');
let imageDescription = document.getElementById('imageDescription');
let homeNav = document.getElementById('homeNav');
let homeButton = document.getElementById('homeButton');
let description = document.getElementById('descriptionPanel');

// Add these missing element lookups
let cameraPanel = document.getElementById('cameraPanel');
let photoPanel = document.getElementById('photoPanel');


function clearphoto() {
    const context = canvas.getContext("2d");
    context.fillStyle = "#AAA";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const dataURL = canvas.toDataURL("image/png");
    photo.setAttribute("src", dataURL);
}

async function takepicture() {
    const context = canvas.getContext("2d");
    if (width && height) {
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);

        const dataURL = canvas.toDataURL("image/png");
        photo.setAttribute("src", dataURL);

        // request AI analysis
        try {
            const response = await fetch(backendURL, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imageURL: dataURL })
              });

            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const json = await response.json();
            console.log(json);
            imageDescription.textContent = json['description'];
            showPhotoView();

        } catch (error) {
            console.error(error.message);
        }

    } else {
        clearphoto();
    }
}


async function setupCameraExample() {
    let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    video.play();
    video.addEventListener(
        "canplay",
        (ev) => {
            if (!streaming) {
                width = video.videoWidth;
                height = video.videoHeight;
                videoAspectRatio = video.videoWidth / video.videoHeight;
                resizeCameraExample();
                streaming = true;
            }
        },
        false,
    );
    
    clearphoto();
    window.addEventListener('resize', resizeCameraExample);

}


function showLiveCameraView() {
    cameraPanel.setAttribute('style', 'display: flex');
    photoPanel.setAttribute('style', 'display: none');   
    homeNav.setAttribute('style', 'display: none');
}

function showPhotoView() {
    cameraPanel.setAttribute('style', 'display: none');
    photoPanel.setAttribute('style', 'display: flex');
    homeNav.setAttribute('style', 'display: flex');
}


function resizeCameraExample() {
    // Find the usable width and height
    let w = document.documentElement.clientWidth;
    let h = document.documentElement.clientHeight;   

    let fitsHorizontally = (0.95 * h * videoAspectRatio < w);

    if (fitsHorizontally) {
        video.setAttribute("height", 0.95 * h);
        video.setAttribute("width", 0.95 * h * videoAspectRatio);
        canvas.setAttribute("height", 0.95 * h);
        canvas.setAttribute("width", 0.95 * h * videoAspectRatio);
    
        photo.setAttribute('style', `width: ${0.95 * h * videoAspectRatio}px; height: ${0.95 * h}px;`);
        description.setAttribute('style', `width: ${0.95 * h * videoAspectRatio}px; height: ${0.95 * h}px;`);

    } else {
    
        video.setAttribute("width", 0.95 * w);
        video.setAttribute("height", 0.95 * w / videoAspectRatio);
        canvas.setAttribute("width", 0.95 * w);
        canvas.setAttribute("height", 0.95 * w / videoAspectRatio);
        photo.setAttribute('style', `width: ${0.95 * w}px; height: ${0.95 * w / videoAspectRatio}px;`);
        description.setAttribute('style', `width: ${0.95 * w}px; height: ${0.95 * w / videoAspectRatio}px;`);

    }
}

  
if (takePhotoButton) {
    takePhotoButton.addEventListener(
        "click",
        (ev) => {
            takepicture();
            ev.preventDefault();
        },
        false,
    );
} else {
    console.warn('takePhotoButton not found in DOM');
}

if (requestButton) {
    requestButton.addEventListener(
        "click",
        async (ev) => {
            try {
                await setupCameraExample();
                requestButton.setAttribute('style', 'display: none;');
                if (cameraPanel) cameraPanel.setAttribute('style', 'display: flex;');
                else console.warn('cameraPanel not found in DOM');
            } catch (err) {
                console.error('Failed to start camera:', err);
                alert('Could not start camera. See console for details.');
            }
        }
    );
} else {
    console.warn('requestButton not found in DOM');
}

if (homeButton) {
    homeButton.addEventListener('click', (event) => {
        showLiveCameraView();
    });
} else {
    console.warn('homeButton not found in DOM');
}