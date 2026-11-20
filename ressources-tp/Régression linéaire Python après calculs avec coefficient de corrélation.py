#Programme Python pour une régression linéaire avec calcul du coefficient de corrélation

#On importe les bibliothèques utiles
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

#On renseigne les listes des grandeurs étudiées (exemple choisi y = 2x²)
x=np.array([0,1,2,3,4,5])
y=np.array([0,2,8,18,32,50])

#On effectue éventuellement les calculs automatiques sur les élements de ces listes
#La commande '.astype(float)' permet les calculs avec de grandes valeurs
X=x.astype(float)**2 # à compléter par un calcul automatique sur tous les éléments de la liste x
Y=y.astype(float) # à compléter par un calcul automatique sur tous les éléments de la liste y

#On réalise la régression linéaire
slope, intercept, r_value, p_value, std_error = stats.linregress(X,Y)
Ymodel = slope*X+intercept

#On affiche l'équation de la droite modèle et le coefficient de corrélation
print ('Y = ',slope,'.X +', intercept)
print ('coefficient de corrélation r :',r_value)

#On trace les graphiques voulus
fig = plt.figure(figsize=(12,10))
plt.plot(X,Y,'r+',label='Y=f(X)')
plt.plot(X,Ymodel,'b-',label='modèle linéaire')
plt.legend()
plt.xlabel("X (unité de X)")
plt.ylabel("Y (unité de Y)")
plt.grid()
plt.title("Régression linéaire de Y = f(X)")
plt.show()