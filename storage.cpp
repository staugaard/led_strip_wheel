#include "storage.h"
#include <SdFat.h>

Storage::Storage(int res, int leds, int strips) {
  imageIndex = 0;
  resolution = res;
  ledsPerStrip = leds;
  stripsPerWheel = strips;
  bytesPerBlock = ledsPerStrip * stripsPerWheel * 3;
}

bool Storage::init() {
  if (card.init(SPI_FULL_SPEED, SS)) {
    if (card.readBlock(0, metadata)) {
      return true;
    } else {
      Serial.println("read of metadata failed");
      return false;
    }
  } else {
    return false;
  }
}

bool Storage::writeMetadata() {
  return card.writeBlock(0, metadata);
}

bool Storage::clear() {
  metadata[0] = 0;
  return writeMetadata();
}

long Storage::imageCount() {
  return (unsigned long)(metadata[3] << 24) | (metadata[2] << 16) | (metadata[1] << 8) | metadata[0];
}

bool Storage::readBlock(int blockIndex, byte buffer[]) {
  return card.readBlock((imageIndex * resolution) + blockIndex + 1, buffer);
}

bool Storage::writeBlock(int blockIndex, byte buffer[]) {
  return card.writeBlock((imageIndex * resolution) + blockIndex + 1, buffer);
}

void Storage::readImage(int index) {
  byte readBuffer[512];

  for (int i = 0; i < resolution; i++) {
    card.readBlock((index * resolution) + i + 1, readBuffer);

    for (int j = 0; j < bytesPerBlock; j++) {
      Serial.write(readBuffer[j]);
    }
  }
}

bool Storage::writeImage(int index) {
  byte writeBuffer[512];

  for (int i = 0; i < resolution; i++) {
    for(int j = 0; j < bytesPerBlock; j++) {
      while (!Serial.available()) {
        delay(1);
      }
      writeBuffer[j] = (byte) Serial.read();
    }

    if (!card.writeBlock((index * resolution) + i + 1, writeBuffer)) {
      Serial.println("failed to write block " + (String) i);
      return false;
    }
  }

  if (index >= imageCount()) {
    metadata[0] = index + 1;
    return writeMetadata();
  } else {
    return true;
  }
}
