import os, sys, io
import M5
from M5 import *
import m5ui
import lvgl as lv
from hardware import Pin
from hardware import I2C
from unit import MiniScaleUnit
import time



page0 = None
label0 = None
label1 = None
label2 = None
label3 = None
label4 = None
i2c0 = None
miniscales_0 = None


def setup():
  global page0, label0, label1, label2, label3, label4, i2c0, miniscales_0

  M5.begin()
  Widgets.setRotation(1)
  m5ui.init()
  page0 = m5ui.M5Page(bg_c=0xffffff)
  label0 = m5ui.M5Label("Weight : ", x=18, y=78, text_c=0x000000, bg_c=0xffffff, bg_opa=0, font=lv.font_montserrat_14, parent=page0)
  label1 = m5ui.M5Label("label1", x=134, y=76, text_c=0x000000, bg_c=0xffffff, bg_opa=0, font=lv.font_montserrat_14, parent=page0)
  label2 = m5ui.M5Label("g", x=248, y=82, text_c=0x000000, bg_c=0xffffff, bg_opa=0, font=lv.font_montserrat_14, parent=page0)
  label3 = m5ui.M5Label("Status : ", x=60, y=148, text_c=0x000000, bg_c=0xffffff, bg_opa=0, font=lv.font_montserrat_14, parent=page0)
  label4 = m5ui.M5Label("label4", x=197, y=148, text_c=0x000000, bg_c=0xffffff, bg_opa=0, font=lv.font_montserrat_14, parent=page0)

  page0.screen_load()
  i2c0 = I2C(0, scl=Pin(33), sda=Pin(32), freq=100000)
  miniscales_0 = MiniScaleUnit(i2c0)
  miniscales_0.set_led(102, 0, 204)
  import network
  import time

  # 1. Complete reset of the WiFi radio
  wlan = network.WLAN(network.STA_IF)
  wlan.active(False)
  time.sleep(1)
  wlan.active(True)

  # 2. Start connection
  print('Attempting connection...')
  wlan.connect('OPPO Reno8 T 5G', 'JAISHRIRAM')

  # 3. Wait loop (increased to 15 seconds)
  counter = 0
  while not wlan.isconnected() and counter < 30:
      time.sleep(0.5)
      counter += 1
      if counter % 4 == 0:
          print("Still trying...")

  if wlan.isconnected():
      print('CONNECTED! IP:', wlan.ifconfig()[0])
  else:
      print('FAILED. 1. Check 2.4GHz band. 2. Check Password.')
  time.sleep(2)


def loop():
  global page0, label0, label1, label2, label3, label4, i2c0, miniscales_0
  M5.update()
  label1.set_text(str(int(miniscales_0.weight)))
  label4.set_text(str(miniscales_0.button))
  try:
      import requests
      import ujson

      # 1. Get weight from the block variable
      # UIFlow 2.0 automatically creates 'miniscales_0'
      w = miniscales_0.weight
      payload = {'weight': w}

      # 2. Your Server URL (REPLACE with your HOTSPOT IP)
      # The port must match your Flask script (default 5000)
      url = "http://10.211.9.46:5000/update_weight"

      headers = {'Content-Type': 'application/json'}

      # POST the data
      response = requests.post(url, data=ujson.dumps(payload), headers=headers)
      response.close()

      print("Success! Sent:", w)

  except Exception as e:
      print("Send Error:", e)
  time.sleep(2)


if __name__ == '__main__':
  try:
    setup()
    while True:
      loop()
  except (Exception, KeyboardInterrupt) as e:
    try:
      m5ui.deinit()
      from utility import print_error_msg
      print_error_msg(e)
    except ImportError:
      print("please update to latest firmware")
