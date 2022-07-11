// -- BEGIN:  Code for controlling the layout-simulation elements --

function updateConfig() {
  let layout = document.config.screen;
  let bounds = document.config.bounds;
  let receiver = document.config.receiver;

  let demoContainer = document.getElementById("demo-container");
  demoContainer.className = layout.value + " " + bounds.value + " " + receiver.value;
}

window.addEventListener('load', function(ev) {
  let layoutGroup = document.config.screen;
  let boundsGroup = document.config.bounds;
  let receiverGroup = document.config.receiver;

  for(entry of layoutGroup) {
    entry.addEventListener('change', updateConfig);
  }

  for(entry of boundsGroup) {
    entry.addEventListener('change', updateConfig);
  }

  for(entry of receiverGroup) {
    if(entry.value == 'full') {
      entry.addEventListener('change', function() {
        let topRange = document.getElementById('topOnlyRadio');
        topRange.checked = 'checked';
        updateConfig();
      });
    } else { // Popup will be the 'default' case - we may want to test multiple 'popup' configs.
      entry.addEventListener('change', function() {
        let popupRange = document.getElementById('popupRadio');
        popupRange.checked = 'checked';
        updateConfig();
      });
    }
  }

  updateConfig();
});

// END: Layout-simulation setup & handling

// START:  Gesture-recognizer integration code!

// This will hold the main gesture-recognizer instance.
// Not great standard practice... but this is a development/debugging page, so we want access to it.
let recognizer;

window.addEventListener('load', function() {
  let recognizerConfig = {
    mouseEventRoot: document.body,
    targetRoot: document.getElementById('target-root'),
    maxRoamingBounds: document.getElementById('roaming-bounds'),
    safeBounds: new com.keyman.osk.PaddedZoneSource(document.getElementById('faux-viewport'), 2),
    safeBoundsPadding: 3
  };

  recognizer = new com.keyman.osk.GestureRecognizer(recognizerConfig);

  recognizer.on('trackedInputUpdate', function(state, coord) {
    console.log(`state: ${state}, coord: ${coord}`);
  });
});

// END:  Gesture-recognizer integration code.