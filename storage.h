#ifndef STORAGE_H
#define STORAGE_H

#include <SdFat.h>

class Storage
{
private:
  long imageIndex;
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

  long imageCount();

  long getImageIndex() { return imageIndex; }
  void setImageIndex(long i) { imageIndex = i; }

  bool readBlock(int blockIndex, byte buffer[]);
  bool writeBlock(int blockIndex, byte buffer[]);

  void readImage(long index);
  bool writeImage(long index);
};

#endif
