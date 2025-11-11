document.addEventListener('DOMContentLoaded', () => {
    // hard-code the backend server (change if needed)
    const backendURL = 'https://image-analysis-server-weld.vercel.app/';

    // DOM lookups (done after DOMContentLoaded to avoid nulls)
    let width = 320;    // We will scale the photo width to this
    let height = 0;     // This will be computed based on the input stream
    let streaming = false;
    let videoAspectRatio = 1.6;
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const output = document.getElementById('photoFrame');
    const photo = document.getElementById('photo');
    const requestButton = document.getElementById('requestButton');
    const takePhotoButton = document.getElementById('takePhotoButton');
    const imageDescription = document.getElementById('imageDescription');
    const homeNav = document.getElementById('homeNav');
    const homeButton = document.getElementById('homeButton');
    const description = document.getElementById('descriptionPanel');
    const cameraPanel = document.getElementById('cameraPanel');
    const photoPanel = document.getElementById('photoPanel');

    function safeLogMissing(id) {
        if (!document.getElementById(id)) console.warn(`Element with id="${id}" not found in DOM`);
    }

    // warn if some expected elements missing
    ['video','canvas','photo','requestButton','takePhotoButton','imageDescription','homeNav','homeButton','descriptionPanel','cameraPanel','photoPanel']
        .forEach(safeLogMissing);

    function clearphoto() {
        const context = canvas.getContext("2d");
        context.fillStyle = "#AAA";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const dataURL = canvas.toDataURL("image/png");
        if (photo) photo.setAttribute("src", dataURL);
    }

    async function takepicture() {
        const context = canvas.getContext("2d");
        if (width && height && video) {
            canvas.width = width;
            canvas.height = height;
            context.drawImage(video, 0, 0, width, height);

            const dataURL = canvas.toDataURL("image/png");
            if (photo) photo.setAttribute("src", dataURL);

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
                    const text = await response.text();
                    throw new Error(`Response status: ${response.status} - ${text}`);
                }

                const json = await response.json();
                console.log('Backend response:', json);
                imageDescription && (imageDescription.textContent = json['description'] || JSON.stringify(json));
                showPhotoView();

            } catch (error) {
                console.error('takepicture error:', error);
                alert('Analysis failed. See console for details.');
            }

        } else {
            clearphoto();
        }
    }

    async function setupCameraExample() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (!video) throw new Error('video element missing');
            video.srcObject = stream;
            await video.play();
            video.addEventListener(
                "canplay",
                (ev) => {
                    if (!streaming) {
                        width = video.videoWidth || width;
                        height = video.videoHeight || Math.floor(width / videoAspectRatio);
                        videoAspectRatio = (video.videoWidth && video.videoHeight) ? (video.videoWidth / video.videoHeight) : videoAspectRatio;
                        resizeCameraExample();
                        streaming = true;
                    }
                },
                false,
            );
            clearphoto();
            window.addEventListener('resize', resizeCameraExample);
            showLiveCameraView();
        } catch (err) {
            console.error('setupCameraExample failed:', err);
            throw err;
        }
    }

    function showLiveCameraView() {
        if (cameraPanel) cameraPanel.style.display = 'flex';
        if (photoPanel) photoPanel.style.display = 'none';
        if (homeNav) homeNav.style.display = 'none';
    }

    function showPhotoView() {
        if (cameraPanel) cameraPanel.style.display = 'none';
        if (photoPanel) photoPanel.style.display = 'flex';
        if (homeNav) homeNav.style.display = 'flex';
    }

    function resizeCameraExample() {
        if (!video || !canvas || !photo || !description) return;

        // Find the usable width and height
        let w = document.documentElement.clientWidth;
        let h = document.documentElement.clientHeight;

        let fitsHorizontally = (0.95 * h * videoAspectRatio < w);

        if (fitsHorizontally) {
            video.height = 0.95 * h;
            video.width = 0.95 * h * videoAspectRatio;
            canvas.height = 0.95 * h;
            canvas.width = 0.95 * h * videoAspectRatio;

            photo.style.width = `${0.95 * h * videoAspectRatio}px`;
            photo.style.height = `${0.95 * h}px`;
            description.style.width = `${0.95 * h * videoAspectRatio}px`;
            description.style.height = `${0.95 * h}px`;

        } else {
            video.width = 0.95 * w;
            video.height = 0.95 * w / videoAspectRatio;
            canvas.width = 0.95 * w;
            canvas.height = 0.95 * w / videoAspectRatio;

            photo.style.width = `${0.95 * w}px`;
            photo.style.height = `${0.95 * w / videoAspectRatio}px`;
            description.style.width = `${0.95 * w}px`;
            description.style.height = `${0.95 * w / videoAspectRatio}px`;
        }
    }

    // Attach listeners (safe guards)
    if (takePhotoButton) {
        takePhotoButton.addEventListener("click", (ev) => {
            ev.preventDefault();
            takepicture();
        }, false);
    } else {
        console.warn('takePhotoButton not found in DOM');
    }

    if (requestButton) {
        requestButton.addEventListener("click", async (ev) => {
            ev.preventDefault();
            try {
                await setupCameraExample();
                requestButton.style.display = 'none';
                if (cameraPanel) cameraPanel.style.display = 'flex';
            } catch (err) {
                console.error('Could not start camera:', err);
                alert('Could not start camera. See console for details.');
            }
        }, false);
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

    // set initial visibility in case CSS doesn't
    showIntro = () => {
        if (cameraPanel) cameraPanel.style.display = 'none';
        if (photoPanel) photoPanel.style.display = 'none';
        if (requestButton) requestButton.style.display = 'flex';
    };
    showIntro();
});