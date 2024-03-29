'''
Nonsensifier, reads language file and makes GoogleTranslate go fucking nuts
WARNING: this program was made with the "just work" intention, so the code may look like shit

Copyright 2020 Polyzium Productions

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>

'''
import ast
import re
import argparse
import sys
import random
import textwrap
import googletrans #pip install googletrans==4.0.0rc1
from time import sleep

parser = argparse.ArgumentParser(description="Reads language file and puts them through Google Translate.")
parser.add_argument("file", metavar="FILE")
parser.add_argument("-r", "--randomize", metavar="AMOUNT", type=int, help="Randomly select AMOUNT languages")
parser.add_argument("-l", "--lore", action="store_true", help="Treat the file as lore, ignores LORETAB and LOREREL entries")
args = parser.parse_args()

chain = []
chainout = "english -> "
if args.randomize and args.randomize <= 0:
	print("Chain size must be greater than 0!")
	sys.exit()
elif args.randomize:
	for i in range(args.randomize): #for (int i=0;i<args.randomize;i++)
		chain.append(random.choice(list(googletrans.LANGUAGES)))
else:
	chain = ['tl', 'af', 'fy', 'et', 'yo', 'pa', 'uz', 'zh-cn', 'mr', 'ug', 'mr', 'or', 'uz', 'ky', 'ky']

for lang in chain:
	chainout += googletrans.LANGUAGES[lang] + " -> "
chainout += "english"
print("Selected chain: "+chainout)

entries = {}
with open(args.file) as langfile:
	for rawentry in re.findall(r".*=\s*\"[^\;]*", langfile.read()):
		if re.findall(" = ", rawentry):
			#Found inline entry
			(entry,txt) = rawentry.split(" = ")
			txt = re.sub(r"^\"|\"$", "", txt)
			txt = re.sub(r"\\c.", "", txt)
			txt = txt.replace("\\n", "\n")
		elif re.findall(" =\n", rawentry):
			#Found multiline entry
			(entry,txt) = rawentry.split(" =\n")
			#Remove junk
			txt = re.sub(r"^\"|\"(?=\n)\n|\"$", "", txt, flags=re.M)
			txt = re.sub(r"\\c.", "", txt)
			txt = txt.replace("\\n", "\n")
			txt = txt.replace('\\"', '\"')
		else:
			#Not an entry
			continue
		if args.lore:
			if re.search(r"LORETAB|LOREREL", entry):
				continue
		if re.search(r"\n\n", txt):
			txt = txt.split("\n\n") #Some entries may be too big for GT, split into paragraphs
			print(entry+" is too big, splitting into "+str(len(txt))+" segments")
		entries[entry] = txt
		#print("Parsed entry "+entry+": ", entries[entry])
		#sleep(0.25)


print("Parsed "+str(len(entries))+" entries")

#https://github.com/ssut/py-googletrans/issues/234
def bruteforce_translate(text, dest, src):
	trans = googletrans.Translator(raise_exception=True)
	while True:
		try:
			#sleep(1)
			if isinstance(text, list):
				#print("Fed text:", text)
				out = []
				#for t in trans.translate(text, dest=dest, src=src):
					#out.append(t.text)
				for s in text:
					#print("Fed text:", s)
					line = trans.translate(s, dest=dest, src=src)
					out.append(line.text)
			else:
				out = trans.translate(text, dest=dest, src=src).text
		except AttributeError as e:
			trans = googletrans.Translator(raise_exception=True)
			#print(e)
			print(sys.exc_info()[2])
			sys.exit()
		else:
			return out


def chain_translate(text):
	print("english -> ", end="", flush=True)
	prevlang = "en"
	prevtext = text
	for lang in chain:
		#print(googletrans.LANGUAGES[prevlang]+"->"+googletrans.LANGUAGES[lang])
		prevtext = bruteforce_translate(prevtext, lang, prevlang)
		prevlang = lang
		print(googletrans.LANGUAGES[lang]+" -> ", end="", flush=True)
		#print(prevtext)
	print("english")
	return bruteforce_translate(prevtext, "en", "auto")

with open(args.file+".gt", mode="x") as outfile:
	outfile.write("// Generated by nonsensifier.py from "+args.file+"\n// Language chain used: "+chainout+"\n[default]\n")
	for entry, txt in entries.items():
		if isinstance(txt, list):
			print("\x1b[31mMultiline text, may take a long time to translate.\x1b[0m")
		print(entry+": ", end="")
		tout = chain_translate(txt)
		if isinstance(tout, list):
			tout = "\\n\\n".join(tout)
		tout = tout.replace("\n", "\\n").replace('\"', '\\"')
		print(tout)
		#chain_translate(txt)
		outfile.write(entry+" = \""+tout+"\";\n")
		outfile.flush()
