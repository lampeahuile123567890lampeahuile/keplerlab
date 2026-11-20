#Programme Python pour une rÃ©gression linÃ©aire avec calcul du coefficient de corrÃ©lation

#On importe les bibliothÃ¨ques utiles
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

#On renseigne les listes des grandeurs Ã©tudiÃ©es (exemple choisi y = 2xÂ²)
x=np.array([0,1,2,3,4,5])
y=np.array([0,2,8,18,32,50])

#On effectue Ã©ventuellement les calculs automatiques sur les Ã©lements de ces listes
#La commande '.astype(float)' permet les calculs avec de grandes valeurs
X=x.astype(float)**2 # Ã  complÃ©ter par un calcul automatique sur tous les Ã©lÃ©ments de la liste x
Y=y.astype(float) # Ã  complÃ©ter par un calcul automatique sur tous les Ã©lÃ©ments de la liste y

#On rÃ©alise la rÃ©gression linÃ©aire
slope, intercept, r_value, p_value, std_error = stats.linregress(X,Y)
Ymodel = slope*X+intercept

#On affiche l'Ã©quation de la droite modÃ¨le et le coefficient de corrÃ©lation
print ('Y = ',slope,'.X +', intercept)
print ('coefficient de corrÃ©lation r :',r_value)

#On trace les graphiques voulus
fig = plt.figure(figsize=(12,10))
plt.plot(X,Y,'r+',label='Y=f(X)')
plt.plot(X,Ymodel,'b-',label='modÃ¨le linÃ©aire')
plt.legend()
plt.xlabel("X (unitÃ© de X)")
plt.ylabel("Y (unitÃ© de Y)")
plt.grid()
plt.title("RÃ©gression linÃ©aire de Y = f(X)")
plt.show()
