#include <Adafruit_NeoPixel.h>
#include <avr/pgmspace.h>
#include "data.h"

const byte numberOfStrips = 4;
const byte numberOfPixels = 15;
const int resolution      = 256;
const int topRowOffset    = (resolution * -0.1);
const int maxTime         = 700;

Adafruit_NeoPixel strips[numberOfStrips] = {
  Adafruit_NeoPixel(numberOfPixels, 8, NEO_GRB + NEO_KHZ800),
  Adafruit_NeoPixel(numberOfPixels, 7, NEO_GRB + NEO_KHZ800),
  Adafruit_NeoPixel(numberOfPixels, 6, NEO_GRB + NEO_KHZ800),
  Adafruit_NeoPixel(numberOfPixels, 5, NEO_GRB + NEO_KHZ800)
};

float brightness;
byte stripIndex;
byte pixelIndex;
int topRowIndex;
int rowIndex;
byte frameNumber;
prog_uchar *rowOffset;

uint8_t r;
uint8_t g;
uint8_t b;

volatile unsigned long lastSpeedInterrupt;
volatile unsigned int millisPerRound = 1000;

unsigned int timeSinceTop;
float position;
int stripPosition;

void setup() {
  lastSpeedInterrupt = millis();

  for (stripIndex = 0; stripIndex < numberOfStrips; stripIndex = stripIndex + 1) {
    strips[stripIndex].begin();
    strips[stripIndex].show();
  }

  digitalWrite(2, HIGH); // this enables the pull-up resistor
  attachInterrupt(0, positionSensorInterrupt, RISING);

//  Serial.begin(9600);
}

void positionSensorInterrupt() {
  millisPerRound = millis() - lastSpeedInterrupt;
  lastSpeedInterrupt = millis();
}

void loop() {
  timeSinceTop = millis() - lastSpeedInterrupt;

  if (tooSlow()) {
    brightness = sin((millis() % 2000) / 2000.0 * PI);

    for (stripIndex = 0; stripIndex < numberOfStrips; stripIndex = stripIndex + 1) {
      for (pixelIndex = 0; pixelIndex < numberOfPixels; pixelIndex = pixelIndex + 1) {
        strips[stripIndex].setPixelColor(pixelIndex, brightness * 255, 0, 0);
      }
      strips[stripIndex].show();
    }

    return;
  }

  position = (timeSinceTop / (float) millisPerRound);

  topRowIndex = (int) (position * resolution);
  topRowIndex += topRowOffset;
  if (topRowIndex < 0) {
    topRowIndex = resolution - topRowIndex;
  } else if (topRowIndex >= resolution) {
    topRowIndex -= resolution;
  }

  frameNumber = (millis() / 1000) % numberOfFrames;

  for (stripIndex = 0; stripIndex < numberOfStrips; stripIndex = stripIndex + 1) {
    stripPosition = topRowIndex + (stripIndex * (resolution / numberOfStrips));
    rowIndex = stripPosition % resolution;
    if (rowIndex < 0) {
      rowIndex = resolution - rowIndex;
    }

    rowOffset = frames[frameNumber] + (numberOfPixels * 3 * rowIndex);

    for (pixelIndex = 0; pixelIndex < numberOfPixels; pixelIndex = pixelIndex + 1) {
      r = pgm_read_byte_near(rowOffset + (pixelIndex * 3));
      g = pgm_read_byte_near(rowOffset + (pixelIndex * 3) + 1);
      b = pgm_read_byte_near(rowOffset + (pixelIndex * 3) + 2);
      strips[stripIndex].setPixelColor(pixelIndex, r, g, b);
    }
    strips[stripIndex].show();
  }

}

bool tooSlow() {
  return millisPerRound > maxTime || timeSinceTop > maxTime;
}
