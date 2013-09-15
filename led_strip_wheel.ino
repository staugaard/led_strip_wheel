#include <SdFat.h>
#include "storage.h"
#include <Adafruit_NeoPixel.h>

const int resolution     = 256;
const int ledsPerStrip   = 35;
const int stripsPerWheel = 4;

Adafruit_NeoPixel strips[stripsPerWheel] = {
  Adafruit_NeoPixel(ledsPerStrip, 23, NEO_GRB + NEO_KHZ800),
  Adafruit_NeoPixel(ledsPerStrip, 20, NEO_GRB + NEO_KHZ800),
  Adafruit_NeoPixel(ledsPerStrip, 17, NEO_GRB + NEO_KHZ800),
  Adafruit_NeoPixel(ledsPerStrip, 14, NEO_GRB + NEO_KHZ800)
};

Storage store = Storage(resolution, ledsPerStrip, stripsPerWheel);
String serialBuffer = "";
byte data[512];
int position = 0;

byte stripIndex;
int stripOffset;
byte pixelIndex;
int pixelOffset;
byte r;
byte g;
byte b;

unsigned long time;

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(5000);
//  while(!Serial) {}
  serialBuffer.reserve(200);

  for (stripIndex = 0; stripIndex < stripsPerWheel; stripIndex = stripIndex + 1) {
    strips[stripIndex].begin();
    strips[stripIndex].show();
  }

  if (!store.init()) {
    Serial.println("card.init failed");
  }

  store.setImageIndex(3);

  handleInfoCommand();
  time = millis();
}

void loop() {
  if(Serial.available()) { serialEvent(); }

  position++;
  if (position >= resolution) {
    Serial.println(resolution * 1000000 / (millis() - time));
    position = 0;
    time = millis();
  }

  store.readBlock(position, data);
//  Serial.println(data[0]);
  updateLEDS();
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
    stripOffset = stripIndex * ledsPerStrip * 3;
    for (pixelIndex = 0; pixelIndex < ledsPerStrip; pixelIndex++) {
      pixelOffset = stripOffset + (pixelIndex * 3);
      r = data[pixelOffset];
      g = data[pixelOffset + 1];
      b = data[pixelOffset + 3];
      strips[stripIndex].setPixelColor(pixelIndex, r, g, b);
    }
    strips[stripIndex].show();
  }
}
