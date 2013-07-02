#include "storage.h"
#include <SdFat.h>

Storage::Storage(int res, int leds, int strips) {
  resolution = res;
  ledsPerStrip = leds;
  stripsPerWheel = strips;
  bytesPerBlock = ledsPerStrip * stripsPerWheel * 3;
}

bool Storage::init() {
  if (card.init(SPI_HALF_SPEED, SS)) {
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

int Storage::imageCount() {
  return (int) metadata[0];
}

bool Storage::readBlock(int blockIndex, byte buffer[]) {
  return card.readBlock((imageIndex * resolution) + blockIndex + 1, buffer);
}

bool Storage::writeBlock(int blockIndex, byte buffer[]) {
  return card.writeBlock((imageIndex * resolution) + blockIndex + 1, buffer);
}

void Storage::readImage(int index) {
  byte readBuffer[512];
  char writeBuffer[bytesPerBlock];

  for (int i = 0; i < resolution; i++) {
    card.readBlock((index * resolution) + i + 1, readBuffer);

    for (int j = 0; j < bytesPerBlock; j++) {
      writeBuffer[j] = static_cast<char>(readBuffer[j]);
    }

    Serial.write(writeBuffer);
  }
}

bool Storage::writeImage(int index) {
  char readBuffer[bytesPerBlock];
  byte writeBuffer[512];

  for (int i = 0; i < resolution; i++) {
    int received = Serial.readBytes(readBuffer, bytesPerBlock);
    if (received < bytesPerBlock) {
      Serial.println("only received " + (String) received + " in block " + (String) i);
      return false;
    }

    for (int j = 0; j < 512; j++) {
      writeBuffer[j] = static_cast<byte>(readBuffer[j]);
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
