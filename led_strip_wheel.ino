#include <Adafruit_NeoPixel.h>
#include <avr/pgmspace.h>
#include "data.h"

Adafruit_NeoPixel strip0 = Adafruit_NeoPixel(15, 5, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel strip1 = Adafruit_NeoPixel(15, 6, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel strip2 = Adafruit_NeoPixel(15, 7, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel strip3 = Adafruit_NeoPixel(15, 8, NEO_GRB + NEO_KHZ800);

Adafruit_NeoPixel strips[] = {strip3, strip2, strip1, strip0};

byte stripIndex;
byte pixelIndex;
int topRowIndex;
int rowIndex;
prog_uchar *rowOffset;

const byte numberOfStrips      = 4;
const byte numberOfPixels      = 15;
const int resolution           = 256;
const int topRowOffset         = (resolution * -0.1);
const int maxTime              = 700;

uint8_t r;
uint8_t g;
uint8_t b;

volatile unsigned long lastSpeedInterrupt;
volatile unsigned int millisPerRound;

unsigned int timeSinceTop;
float position;
int stripPosition;

void setup() {
  millisPerRound = 1000;
  lastSpeedInterrupt = millis();

  for (stripIndex = 0; stripIndex < numberOfStrips; stripIndex = stripIndex + 1) {
    strips[stripIndex].begin();
    strips[stripIndex].show();
  }

  digitalWrite(2, HIGH);
  attachInterrupt(0, positionSensorInterrupt, RISING);

//  Serial.begin(9600);
}

void loop() {
  timeSinceTop = millis() - lastSpeedInterrupt;

  if (millisPerRound > maxTime || timeSinceTop > maxTime) {
    for (stripIndex = 0; stripIndex < numberOfStrips; stripIndex = stripIndex + 1) {
      for (pixelIndex = 0; pixelIndex < numberOfPixels; pixelIndex = pixelIndex + 1) {
        strips[stripIndex].setPixelColor(pixelIndex, 255, 0, 0);
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

  for (stripIndex = 0; stripIndex < numberOfStrips; stripIndex = stripIndex + 1) {
    stripPosition = topRowIndex + (stripIndex * (resolution / numberOfStrips));
    rowIndex = stripPosition % resolution;
    if (rowIndex < 0) {
      rowIndex = resolution - rowIndex;
    }

    rowOffset = data + (numberOfPixels * 3 * rowIndex);

    for (pixelIndex = 0; pixelIndex < numberOfPixels; pixelIndex = pixelIndex + 1) {
      r = pgm_read_byte_near(rowOffset + (pixelIndex * 3));
      g = pgm_read_byte_near(rowOffset + (pixelIndex * 3) + 1);
      b = pgm_read_byte_near(rowOffset + (pixelIndex * 3) + 2);
      strips[stripIndex].setPixelColor(pixelIndex, r, g, b);
    }
    strips[stripIndex].show();
  }

}

void positionSensorInterrupt() {
  millisPerRound = millis() - lastSpeedInterrupt;
  lastSpeedInterrupt = millis();
}

