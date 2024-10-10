const retry_btn = document.getElementById('retry_btn');
const save_btn = document.getElementById('save_btn');

retry_btn.addEventListener('click', () => {
    let faceNumber = localStorage.getItem('dmxState-faceNumber');
    const facePath = localStorage.getItem(`dmxState-facePath_${faceNumber}`);

    localStorage.removeItem(`dmxState-facePath_${faceNumber}`);
    faceNumber == 1 ? faceNumber = 1 : faceNumber = 2;
    localStorage.setItem('dmxState-faceNumber', faceNumber);

    // Make an API call to delete the file from the server
    fetch(`/delete-file?path=${encodeURIComponent(facePath)}`, {
        method: 'DELETE'
    }).then(response => {
        if (response.ok) {
            console.log('File deleted successfully');
        } else {
            console.error('Error deleting the file');
        }
    }).catch(error => {
        console.error('Error:', error);
    });

    // Redirect to camera page again (as per the existing logic)
    window.location.href = '/?cameraOpen=true';
});


save_btn.addEventListener('click', async () => {
    let faceNumber = localStorage.getItem('dmxState-faceNumber');
    const facePath = localStorage.getItem(`dmxState-facePath_${faceNumber}`);

    if (faceNumber >= 2) {
        //redirect to text extraction page
        window.location.href = '/extraction';
    } else {
        faceNumber = parseInt(faceNumber, 10) + 1;
        localStorage.setItem('dmxState-faceNumber', faceNumber);
        //redirect to camera page
        window.location.href = '/?cameraOpen=true';
    }
});

if (window.location.pathname === '/photoResult') {
    window.addEventListener('load', () => {
        const faceNumber = localStorage.getItem('dmxState-faceNumber');
        const pageTitle = document.getElementById('pageTitle');
        const facePath = localStorage.getItem(`dmxState-facePath_${faceNumber}`).replace(/"/g, '');
        console.log(facePath);
        const img = document.getElementById('imgResult');
        const save_btn = document.getElementById('save_btn');

        pageTitle.textContent = `Photo ${faceNumber}`;
        img.src = `/uploads/${facePath}`;

        //save_btn.innerHTML = faceNumber >= 2 ? '<i class="fas fa-magic"></i> Extract Text' : '<i class="fas fa-save"></i> Save & Continue';


    });
}