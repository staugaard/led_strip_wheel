#include <SdFat.h>
#include "storage.h"

const int resolution     = 256;
const int ledsPerStrip   = 36;
const int stripsPerWheel = 4;

Storage store = Storage(resolution, ledsPerStrip, stripsPerWheel);
String serialBuffer = "";

void setup() {
  Serial.begin(115200);
  while(!Serial) {}
  serialBuffer.reserve(200);

  if (!store.init()) {
    Serial.println("card.init failed");
  }

  handleInfoCommand();
}

void loop() {
  if(Serial.available()) { serialEvent(); }
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
  } else {
    Serial.println("Unknown command");
  }
}

void handleInfoCommand() {
  Serial.println("image_count: " + (String) store.imageCount());
}

