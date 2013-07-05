#include <SdFat.h>
#include "storage.h"

const int resolution     = 256;
const int ledsPerStrip   = 36;
const int stripsPerWheel = 4;

Storage store = Storage(resolution, ledsPerStrip, stripsPerWheel);
String serialBuffer = "";
byte data[512];
int position = 0;
int stripIndex;

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(5000);
  while(!Serial) {}
  serialBuffer.reserve(200);

  if (!store.init()) {
    Serial.println("card.init failed");
  }

  handleInfoCommand();
}

void loop() {
  if(Serial.available()) { serialEvent(); }

  position++;
  if (position >= resolution) {
    position = 0;
  }

//  store.readBlock(0, data);
//  Serial.println(data[0]);
//  updateLEDS();
}

void serialEvent() {
  while (Serial.available()) {
    char inChar = (char) Serial.read();

    if (inChar == '\n') {
      handleSerialCommand(serialBuffer);
      serialBuffer = "";
    } else {
      serialBuffer += inChar;
    } 
  }
}

void handleSerialCommand(String command) {
  if(command == "clear") {
    if(store.clear()) {
      Serial.println("OK");
    }
  } else if(command == "info") {
    handleInfoCommand();
  } else if(command.startsWith("read_image ")) {
    store.readImage(command.substring(11).toInt());
  } else if(command.startsWith("write_image ")) {
    store.writeImage(command.substring(12).toInt());
    Serial.println("OK");
  } else {
    Serial.println("Unknown command");
  }
}

void handleInfoCommand() {
  Serial.println("image_count: " + (String) store.imageCount());
}

void updateLEDS() {
  for (stripIndex = 0; stripIndex < stripsPerWheel; stripIndex++) {
    
  }
}
