#ifndef STORAGE_H
#define STORAGE_H

#include <SdFat.h>

class Storage
{
private:
  int imageIndex;
  Sd2Card card;
  byte metadata[512];
  bool writeMetadata();
  int resolution;
  int ledsPerStrip;
  int stripsPerWheel;
  int bytesPerBlock;

public:
  Storage(int resolution, int ledsPerStrip, int stripsPerWheel);

  bool init();
  bool clear();

  int imageCount();

  int getImageIndex() { return imageIndex; }
  void setImageIndex(int i) { imageIndex = i; }

  bool readBlock(int blockIndex, byte buffer[]);
  bool writeBlock(int blockIndex, byte buffer[]);

  bool storeImage(int index);
};

#endif
