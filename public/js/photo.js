// public/app.js

document.addEventListener('DOMContentLoaded', () => {
    const faceNumber = localStorage.getItem('dmxState-faceNumber');
    const pageTitle = document.getElementById('pageTitle');
    pageTitle.textContent = `Photo ${faceNumber}`;
    const openCameraBtn = document.getElementById('openCameraBtn');
    const openCameraBtn2 = document.getElementById('openCameraBtn2');
    const closeCameraBtn = document.getElementById('close-camera-btn');
    const cancel_btn = document.getElementById('cancel_btn');
    const video = document.getElementById('video');
    const videoContainer = document.getElementById('video-container');
    const captureBtn = document.getElementById('capture_btn');
    const flash = document.createElement('div');
    flash.classList.add('flash');
    document.body.appendChild(flash);
    let stream;

    cancel_btn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/';
    });

    const getUrlParameter = (name) => {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    };

    const initializeFaceNumber = () => {
        let faceNumber = localStorage.getItem('dmxState-faceNumber');
        if (!faceNumber) {
            localStorage.setItem('dmxState-faceNumber', '1');
            faceNumber = '1';
        }
        const faceNumber_ph = document.getElementById('faceNumber_ph');
        if (faceNumber_ph) {
            faceNumber_ph.textContent = faceNumber;
        }
    };

    const openCamera = async (facingMode, button) => {
        console.log(`Open Camera button clicked with facingMode: ${facingMode}`);
        videoContainer.style.display = 'flex';

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode },
                audio: false,
            });
            console.log('Camera stream obtained with facingMode:', facingMode);
            video.srcObject = stream;
        } catch (error) {
            console.error('Error accessing the camera:', error);
            alert('Unable to access the camera. Please check your permissions.');
            button.parentElement.style.display = 'flex';
            videoContainer.style.display = 'none';
        }
    };

    const closeCamera = () => {
        console.log('Close Camera button clicked');
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        videoContainer.style.display = 'none';
        openCameraBtn.parentElement.style.display = 'flex';
        openCameraBtn.style.display = 'block';
        openCameraBtn2.style.display = 'block';
        cancel_btn.style.display = 'block';
    };

    function dataURLtoBlob(dataurl) {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        return new Blob([u8arr], { type: mime });
    }

    const capturePhoto = async () => {
        flash.classList.add('active');
        setTimeout(() => {
            flash.classList.remove('active');
        }, 200);
        const canvas = document.createElement('canvas');
        const scaleFactor = 500 / video.videoWidth;
        canvas.width = 500;
        canvas.height = video.videoHeight * scaleFactor;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/png');
        //console.log('Captured image data URL:', imageDataUrl);

        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(currentDate.getSeconds()).padStart(2, '0');
        const imgeName = `${year}${month}${day}-${hours}${minutes}${seconds}`;

        const blob = dataURLtoBlob(imageDataUrl);
        console.log('Blob size:', blob.size);
        const faceNumber = localStorage.getItem('dmxState-faceNumber');
        const fileName = `${imgeName}_${faceNumber}.png`;
        const formData = new FormData();
        if (blob && fileName) {
            formData.append('image', blob, fileName);
        } else {
            console.error('Error: Blob or filename is missing');
            return;
        }
        localStorage.setItem(`dmxState-facePath_${faceNumber}`, `"${fileName}"`);

        try {
            const response = await fetch('/upload_img', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                console.log('Image uploaded successfully');
                window.location.href = '/photoResult';
            } else {
                console.error('Image upload failed');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
        }
    };

    openCameraBtn.addEventListener('click', () => openCamera('user', openCameraBtn));
    openCameraBtn2.addEventListener('click', () => openCamera('environment', openCameraBtn2));
    closeCameraBtn.addEventListener('click', closeCamera);
    captureBtn.addEventListener('click', capturePhoto);

    if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
        window.addEventListener('load', initializeFaceNumber);
    }

    if (getUrlParameter('cameraOpen') === 'true') {
        openCameraBtn.click();
    }
});
