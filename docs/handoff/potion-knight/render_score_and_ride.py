import sys,math,wave,subprocess
from pathlib import Path
import cv2 as cv,numpy as np
sr=44100;N=int(15.16*sr);mix=np.zeros((N,2));beat=.472
def note(t,n,d,v,voice,pan):
 j=round(t*sr);l=min(N-j,round(d*sr))
 if l<=0:return
 x=np.arange(l)/sr;f=440*2**((n-69)/12);phase=2*np.pi*f*x
 if voice=='strings':
  a=(1-np.exp(-12*x))*np.minimum(1,(d-x)/.19).clip(0,1);y=sum(np.sin(k*(phase+.018*np.sin(31*x)))/k**1.55 for k in range(1,6))*a
 else:
  y=(np.sin(phase)+.36*np.sin(2*phase)+.14*np.sin(3*phase))*np.exp(-x*(3 if voice=='lead' else 6))*(1-np.exp(-100*x))*np.minimum(1,(d-x)/.08).clip(0,1)
 mix[j:j+l]+=v*y[:,None]*np.array([math.sqrt(1-pan),math.sqrt(pan)])
chords=[(50,57,62,65),(46,53,58,62),(48,55,60,64),(45,52,57,61),(53,60,65,69),(48,55,60,64),(46,53,58,62),(50,57,62,66)]
mel=[[69,72,74],[70,69,65],[67,71,72],[69,68,69],[72,76,77],[76,72,67],[70,74,77],[76,74,74]]
for bar,ch in enumerate(chords):
 t=4*beat*bar
 for k,p in enumerate(ch):note(t,p,4*beat+.12,.061,'strings',.23+.15*k)
 for k in range(8):note(t+k*beat/2,ch[[0,2,1,3,0,1,2,3][k]]+12,.65,.082,'harp',.28)
 for k,p in enumerate(mel[bar]):note(t+[0,1.5,2.5][k]*beat,p,[1.45,.95,1.55][k]*beat,.19,'lead',.61)
mix[int(.13*sr):]+=.15*mix[:-int(.13*sr)].copy(); mix[-int(.38*sr):]*=np.linspace(1,0,int(.38*sr))[:,None]
with wave.open('score96.wav','w') as o:o.setparams((2,2,sr,0,'NONE',''));o.writeframes((mix.clip(-.95,.95)*32767).astype('<i2').tobytes())
# Separate the mounted rider from the background and animate his approach and settling weight.
src=cv.imread(str(Path(__file__).with_name('ride-source.png')));src=cv.resize(src,(960,540))
mask=np.zeros((540,960),np.uint8)
pts=np.array([(35,189),(43,154),(63,139),(57,124),(67,104),(114,88),(130,89),(141,68),(183,65),(178,80),(191,91),(180,122),(195,116),(208,104),(217,117),(236,124),(242,165),(226,177),(212,169),(201,184),(215,195),(194,226),(178,231),(168,218),(147,220),(129,232),(103,208),(86,231),(74,228),(89,198),(70,196)])*2
cv.fillPoly(mask,[pts],cv.GC_PR_FGD);cv.grabCut(src,mask,None,np.zeros((1,65)),np.zeros((1,65)),4,cv.GC_INIT_WITH_MASK)
m=((mask%2)*255).astype('uint8');bg=cv.inpaint(src,cv.dilate(m,np.ones((5,5),np.uint8)),5,cv.INPAINT_TELEA)
fg=np.dstack((src,m))
out=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s','960x540','-r','25','-i','-','-c:v','libx264','-pix_fmt','yuv420p','ride96.mp4'],stdin=subprocess.PIPE)
for i in range(42):
 u=i/41;p=1-(1-u)**2;hop=abs(math.sin(p*math.pi*3))*(1-u)
 mat=cv.getRotationMatrix2D((300,420),1.6*hop,1);mat[:,2]+=[-260*(1-p),-12*hop];z=cv.warpAffine(fg,mat,(960,540));a=z[:,:,3:4]/255;im=np.uint8(z[:,:,:3]*a+bg*(1-a));out.stdin.write(im.tobytes())
out.stdin.close();assert out.wait()==0
