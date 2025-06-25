---
title: "UIUCTF 2023 - Tornado Warning"
description: "Writeups for Misc Challenges from UIUCTF 2023"
date: 'Nov 17 2023'
tags: ['writeup', 'uiuctf23', 'misc']
authors: ['ctfguy']
---

## Tornado Warning

### Description:

> Check out this alert that I received on a weather radio. Somebody transmitted a secret message via errors in the header! Fortunately, my radio corrected the errors and recovered the original data. But can you find out what the secret message says?


> Note: flag is not case sensitive.


|**Category** | **Points** | **Author** |
| --- | --- | --- |
|Misc | 117 | Pomona|
  


<details>
    <summary>Hint 0 (Click to Show/Hide)</summary>

The header is encoded with Specific Area Message Encoding.

</details>


<details>
    <summary>Hint 1 (Click to Show/Hide)</summary>

The three buzzes are supposed to be identical, but in this challenge, they are different due to errors.
</details>




### Attachment

[warning.wav](https://2023.uiuc.tf/files/ff16d04bef6f15d6da26adab17478046/warning.wav)



### Introduction 

So this was a unique kind of challenge that we came across in UIUCTF 2023 . We were close to solving this problem during the CTF but couldn't complete. However, we were able to solve it after the CTF and our approach seems unique , hence thought of making this writeup.


### Analysis

First as soon as we saw the audio file , the first thing that came to our mind was to use Audacity/Sonic Visualiser to analyse the audio file. But then we saw the hints.

The first hint gave us an idea about the file. So we did some research on the Specific Area Message Encoding (SAME).

While doing some research , understanding what exactly it means and trying to somehow get the **SAME** header we came across this [site](https://codepen.io/cosmicduncan1337/full/XxGoNE) which had the following image:

![tools](https://i.imgur.com/GhzYLee.png)

When you look at the image it you can notice they are using a tool called **SeaTTY** which seams to give **SAME** header *(you can learn more about this [here](https://emergencyalertsystem.fandom.com/wiki/Specific_Area_Message_Encoding))*. Thats how we got the idea to approach this problem.

### Solution

So from analysing the file we got to know what tool to use. Now using the tool was one of the problematic task here. We got some basic ideas on how to use this tool from the [videos](https://www.youtube.com/watch?v=AiXKs5VYR9k) used in this channel.

This tool automatically captures the audio from other sources like the desktop sound and also from mic even though you give it an audio file to decode from. Also, when any of the source mentioned above was muted the audio file was not captured. 

This audio problem was solved by our teammate and the WAV file decodes to this message.

![image](https://github.com/ctfguy/My_CTF_Writeups/assets/138273779/9ea9d2b8-9295-4922-9bee-829716fce1f1)


```
ZCZC-UXU-TFR-R18007ST_45-0910BR5-KIND3RWS-____
ZCZC-WIR-TO{3018W0R+00T5-09UT115-K_EV/NWS-
____
ZCZC-WXRCTOR-0D_007+004OR_O1011E@KIND/N}S-____
NNNN____
```

The steps followed to achieve this result using SeaTTY are:

* First change the mode to decode SAME by `Mode > NWR-SAME`

* Make sure you mute your mic and other audio capturing sources in the device. This makes sure you don't get any unnecessary values

* Then select the audio file to decode by `File > Decode from file > <choose_the_audio_file_in_the_dialouge_box_that_appears>` 

* Other settings are kept in default as shown in the above image
  
* You can manually start the decoding process by pressing the start button if it doesn't start the decoding automatically after choosing the file

This seems interesting because based on the sources we read about [SAME Header](https://emergencyalertsystem.fandom.com/wiki/Specific_Area_Message_Encoding) , it should follow a certain set of instruction which this decoded text didn't follow.

Thats when we understood the second hint and realised the error are made intentional and we got the flag somewhere here. 

After some discussions and playing around these texts removing some common character from the start and end of each line of decoded text with bing chat we came up with the following solve script to get the flag from these decoded message we got using the tool.

### Solve Script

```py
m1 = "UXU-TFR-R18007ST_45-0910BR5-KIND3RW"
m2 = "WIR-TO{3018W0R+00T5-09UT115-K_EV/NW"
m3 = "WXRCTOR-0D_007+004OR_O1011E@KIND/N}"
flag=""
size=len(m1)
for i in range(size):
    chars = [m1[i], m2[i], m3[i]]
    vals = [ord(char) for char in chars]
    result = vals[0] ^ vals[1] ^ vals[2]
    flag += chr(result)

print(f'flag = {flag}')
```
The idea used here is, for each position the code performs a bitwise XOR operation on the ASCII values of the characters from all three lines decoded messages we got, combines all of them and prints the flag .

### Output/Flag:

`flag = UIUCTF{3RD_W0RST_TOR_OUTBRE@K_EV3R}`

