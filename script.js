// More API functions here:
// https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image

// the link to your model provided by Teachable Machine export panel
const URL = "https://teachablemachine.withgoogle.com/models/6cQVQ17Ij/";

const VALIDATE_TIME  = 2000;  // Time in milliseconds before the scanner validates the banknote
const SCAN_WAIT_TIME = 5000;  // Time in milliseconds before the scanner can scan again
const SUM_RESET_TIME = 20000; // Time in milliseconds before the sum is reset

const states = ["ready", "scanning", "counting", "waiting"];
/*  
    Sum counter states:
    0 = ready, user can scan banknotes
    1 = scanning, the scanner is waiting for 2 seconds to make sure the banknote is stable, any change in banknote will reset the state
    2 = waiting, the scanner is waiting for 5 seconds before it can scan again
*/

// Global variables

let model, webcam, labelContainer, predictions;  // Variables for banknote detection
let sum, state, value, banknote, maxPrediction;  // Variables for sum counter
let scanningTimer, sumResetTimer;                // Timers for sum counter

//tts settings
let languageSelect;
let utterance = new SpeechSynthesisUtterance();
utterance.volume = 2;
utterance.rate = .6;
utterance.pitch = 1;

window.onload = function() {
    let start = document.getElementById("start");
    let spinner = document.getElementById("loading-spinner");
  
    start.addEventListener("click", function() {
        start.style.display = 'none';

        spinner.style.display = 'block';
        spinner.style.margin = 'auto';
        spinner.style.marginTop = '150px';

        if (start.style.display === "none") {
            return;
        }
        init();

    });
}


// Load the image model and setup the webcam
async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    // load the model and metadata
    // Refer to tmImage.loadFromFiles() in the API to support files from a file picker
    // or files from your local hard drive
    // Note: the pose library adds "tmImage" object to your window (window.tmImage)
    model = await tmImage.load(modelURL, metadataURL);
    predictions = model.getTotalClasses();

    // Convenience function to setup a webcam
    const flip = true; // whether to flip the webcam
    webcam = new tmImage.Webcam(window.innerWidth/1.35, window.innerHeight/1.35, flip); // width, height, flip
    await webcam.setup(); // request access to the webcam
    await webcam.play();
    window.requestAnimationFrame(loop);

    // Append webcam element to the DOM
    document.getElementById("webcam-container").appendChild(webcam.canvas);

    // Create div containers for prediction values and append the labels to the DOM
     labelContainer = document.getElementById("label-container");
          for (let i = 0; i < predictions; i++) { // and class labels
         labelContainer.appendChild(document.createElement("div"));
     }

    // Set variables for sum counter
    state = 0;
    sum = 0;
    banknote = "baseCase";

    // Hide loading spinner
    document.getElementById("loading-spinner").style.display = 'none';
    document.getElementById("sum-display").style.display = 'block';
    document.getElementById("description").style.display = 'none';
    languageSelect = document.getElementById('language');
}

async function loop() {
    webcam.update(); // update the webcam frame
    await predict();
    window.requestAnimationFrame(loop);
}

// run the webcam image through the image model
async function predict() {
    // language update
    const language = languageSelect.value;
    if (language) {
        utterance.lang = language;
    }

    // predict can take in an image, video or canvas html element
    const prediction = await model.predict(webcam.canvas);

    // Temporary variables for sum counter
    value = 0;                  // Value of banknote
    const THRESHOLD = 0.95;     // Threshold for banknote detection
    maxPrediction = null;       // Prediction with the highest probability

    // Loop to check each prediction value
    for (let i = 0; i < predictions; i++) {
        // Inject prediction values into HTML
        const classPrediction = prediction[i].className + ": " + prediction[i].probability.toFixed(2);
         labelContainer.childNodes[i].innerHTML = classPrediction;

        // Get the largest prediction
        if (maxPrediction == null || prediction[i].probability.toFixed(2) > maxPrediction.probability.toFixed(2)) {
            maxPrediction = prediction[i];
        }
    }

    // Check the state of the sum counter
    switch (state) {
        // If the scanner is ready to scan
        case 0:
            if (maxPrediction.probability.toFixed(2) > THRESHOLD && maxPrediction.className != "baseCase") {
                banknote = maxPrediction.className
                scanningTimer = setInterval(() => {
                    if (state == 1) {
                        state = 2;
                        console.log("Switching to " + states[state] + " state");
                    }
                }, VALIDATE_TIME);
                
                state = 1;
                console.log("Switching to " + states[state] + " state");
            }
        break;

        // If the scanner is validating the banknote
        case 1:
            // Check if banknote has changed during the scanning state is 
            if (banknote && maxPrediction.className != banknote) {
                console.log("Banknote changed, resetting");
                console.log("maxPrediction is " + maxPrediction.className + " and banknote is " + banknote);
                state = 0;
                clearInterval(scanningTimer);
            }
        break;

        // If the scanner has a valid banknote
        case 2:
            // Get banknote value
            switch (banknote) {
                case "oneDollar": value = 1; break;
                case "fiveDollar": value = 5; break;
                case "tenDollar": value = 10; break;
                case "twentyDollar": value = 20; break;
                case "fiftyDollar": value = 50; break;
                case "hundredDollar": value = 100; break;
                default: value = 0; break;
            }

            console.log("Banknote is " + banknote + " and value is " + value);

            // Add banknote value to sum if banknote is detected
            if (value > 0) {
                sum += value;
                clearInterval(sumResetTimer);  // Cancel sum reset timer, if another banknote is detected within 20 seconds

                // Debugging
                console.log("Banknote detected: " + banknote + " (" + value + ") - Sum: " + sum);
                console.log("Waiting 5 seconds before scanning again");

                //tts says dollar amount when scanned
                if (value == 1){
                    utterance.text = value + " dollar";
                    window.speechSynthesis.speak(utterance);
                } else {
                    utterance.text = value + " dollars";
                    window.speechSynthesis.speak(utterance);
                }
                
                // Wait 5 seconds before scanning again (resetting the state) to prevent double scanning
                setTimeout(() => {
                    console.log("Switching to " + states[state] + " state");
                    state = 0;
                }, SCAN_WAIT_TIME);
                console.log("Switching to " + states[state] + " state");
                
                // Reset sum if no banknote is detected for 20 seconds
                if (sum > 0) {
                    sumResetTimer = setTimeout(() => {
                        console.log("No data after 20 seconds, clearing the sum!");
                        utterance.text = "Sum of scanned bills: " + sum + " dollars";
                        window.speechSynthesis.speak(utterance);
                        sum = 0;
                    }, SUM_RESET_TIME);
                }
                state = 3;
            }
        break;

        // If the scanner is in waiting state (waiting for 5 seconds before scanning again)
        case 3:

        break;
    }

    // Update sum on html page
    document.getElementById("sum").innerHTML = sum;
}