#On importe les modules necessaires aux calculs et representations graphiques
from math import *
import numpy as np
import matplotlib.pylab as plt

###########################################
### Donnees experimentales a renseigner ###
###########################################

## t en min
t=[]
## latitude en degre
lat=[]
## longitude en degre
lon=[]
## altitude en km
h=[]

######################################
### Fin des donnees experimentales ###
###          a renseigner          ###
######################################

### Ne pas modifier les donnees terrestres ci-dessous ###

## Rayon terrestre en km
Rt=6378.0
## Jour sideral en min
Js=1436.066
## Vitesse angulaire en degre/min
w=360/Js
## nombre de positions : la fonction 'len' renvoie ici a la longueur d'une liste
n=len(t)

## initialisations : la fonction 'zeros' crée un tableau rempli de 0
r=np.zeros(n)
loncr=np.zeros(n)
latr=np.zeros(n)
x=np.zeros(n)
y=np.zeros(n)
z=np.zeros(n)
d=np.zeros(n-1)
v=np.zeros(n-1)
S=np.zeros(n-1)
s=np.zeros(n-1)
tt=np.zeros(n-1)

#On cree la boucle calculant les coordonnees du satellite en km dans
#le referentiel geocentrique
for i in range(n):
## rayon du satellite
	r[i]=h[i]+Rt
## longitude après correction de la rotation propre terrestre, convertie en rad
	loncr[i]=(lon[i]+w*t[i])/180*pi
## latitude convertie en rad
	latr[i]=lat[i]/180*pi
## coordonnees en km (cf. convention rayon-longitude-latitude en spherique)
	x[i]=r[i]*cos(latr[i])*cos(loncr[i])
	y[i]=r[i]*cos(latr[i])*sin(loncr[i])
	z[i]=r[i]*sin(latr[i])

## mouvement
for i in range(n-1):
## Temps sans derniere mesure
	tt[i]=t[i]

##############################
### Programme a completer ####
##############################

#On cree la fonction calculant l'aire via la formule de Heron
def aire(a,b,c):
	p= #a completer
	S= #a completer
	return S

#On calcule les grandeurs mecaniques utiles
for i in range(n-1):
## Distance parcourue entre i et i+1, en km
	d[i]= #a completer
## vitesse en km/min
	v[i]= #a completer
## aire balayee en km2
	S[i]= #a completer en utilisant la fonction 'aire' definie precedemment
## vitesse areolaire en km2/min
	s[i]= #a completer

#####################################
### Fin du programme a completer ####
#####################################

### Ne pas modifier la suite du programme ###

#On prend un peu de marge pour la representation des graphes a venir
tmax=max(tt)+2
rmax=max(r)*1.1
vmax=max(v)*1.1
Smax=max(S)*1.1
smax=max(s)*1.1

#On construit les divers graphes pertinents
fig=plt.figure(1,figsize=(4,9))
fig.subplots_adjust(bottom=0.085, left=0.225, top = 0.975, right=0.975)
fig.add_subplot(3,1,1)

plt.plot(t,r,"+")
plt.title("Rayon en fonction du temps")
plt.xlabel("temps en min")
plt.ylabel("rayon en km")
plt.xlim(0,tmax)
plt.ylim(0,rmax)
plt.grid(True)
fig.add_subplot(3,1,2)

plt.plot(tt,v,"+")
plt.title("Vitesse en fonction du temps")
plt.xlabel("temps en min")
plt.ylabel("vitesse en km/min")
plt.xlim(0,tmax)
plt.ylim(0,vmax)
plt.grid(True)
fig.add_subplot(3,1,3)

plt.plot(tt,s,"+")
plt.title("Vitesse areolaire en fonction du temps")
plt.xlabel("temps en min")
plt.ylabel("vitesse areolaire en km^2/min")
plt.xlim(0,tmax)
plt.ylim(0,smax)
plt.grid(True)

plt.show()