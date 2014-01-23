#include <SdFat.h>
#include "storage.h"
#include <Adafruit_NeoPixel.h>

const int resolution     = 256;
const int ledsPerStrip   = 36;
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
volatile unsigned long lastSpeedInterrupt;
volatile unsigned int millisPerRound = 1000;
unsigned int timeSinceTop;
long numberOfImages;

byte stripIndex;
int stripOffset;
byte pixelIndex;
int pixelOffset;
byte r;
byte g;
byte b;

void setup() {
  for (stripIndex = 0; stripIndex < stripsPerWheel; stripIndex = stripIndex + 1) {
    strips[stripIndex].begin();
    strips[stripIndex].show();
  }

  while(!store.init()) {
    showCalibration();
    delay(1000);
  }

  numberOfImages = store.imageCount();

  lastSpeedInterrupt = millis();
  pinMode(2, INPUT_PULLUP);
  attachInterrupt(2, positionSensorInterrupt, FALLING);
}

void positionSensorInterrupt() {
  millisPerRound = millis() - lastSpeedInterrupt;
  lastSpeedInterrupt = millis();
}

void loop() {
  store.setImageIndex((millis() / 120) % numberOfImages);

  timeSinceTop = millis() - lastSpeedInterrupt;

  position = (timeSinceTop / (float) millisPerRound) * resolution;
  position = position % resolution;

  store.readBlock(position, data);
  updateLEDS();
}

void updateLEDS() {
  for (stripIndex = 0; stripIndex < stripsPerWheel; stripIndex++) {
    stripOffset = stripIndex * ledsPerStrip * 3;
    for (pixelIndex = 0; pixelIndex < ledsPerStrip; pixelIndex++) {
      pixelOffset = stripOffset + (pixelIndex * 3);
      r = data[pixelOffset];
      g = data[pixelOffset + 1];
      b = data[pixelOffset + 2];
      strips[stripIndex].setPixelColor(pixelIndex, r, g, b);
    }
    strips[stripIndex].show();
  }
}

void showCalibration() {
  strips[0].setPixelColor(0,                255, 0, 0);
  strips[0].setPixelColor(ledsPerStrip - 1, 255, 0, 0);
  strips[0].setPixelColor(ledsPerStrip - 2, 255, 0, 0);
  strips[0].show();

  strips[1].setPixelColor(0,                0, 255, 0);
  strips[1].setPixelColor(ledsPerStrip - 1, 0, 255, 0);
  strips[1].setPixelColor(ledsPerStrip - 2, 0, 255, 0);
  strips[1].show();

  strips[2].setPixelColor(0,                0, 0, 255);
  strips[2].setPixelColor(ledsPerStrip - 1, 0, 0, 255);
  strips[2].setPixelColor(ledsPerStrip - 2, 0, 0, 255);
  strips[2].show();

  strips[3].setPixelColor(0,                255, 255, 255);
  strips[3].setPixelColor(ledsPerStrip - 1, 255, 255, 255);
  strips[3].setPixelColor(ledsPerStrip - 2, 255, 255, 255);
  strips[3].show();
}
