import math
# GRS80 TM (EPSG:5186: lon0 127, lat0 38, k0 1, FE 200000, FN 600000)
a=6378137.0; f=1/298.257222101; e2=f*(2-f); ep2=e2/(1-e2)
def M(phi): return a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi-(3*e2/8+3*e2**2/32+45*e2**3/1024)*math.sin(2*phi)+(15*e2**2/256+45*e2**3/1024)*math.sin(4*phi)-(35*e2**3/3072)*math.sin(6*phi))
def to5186(lat,lon,lon0=127.0,lat0=38.0,FE=200000.0,FN=600000.0,k0=1.0):
    phi=math.radians(lat); lam=math.radians(lon-lon0)
    N=a/math.sqrt(1-e2*math.sin(phi)**2); T=math.tan(phi)**2; C=ep2*math.cos(phi)**2; A=lam*math.cos(phi)
    x=FE+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120)
    y=FN+k0*(M(phi)-M(math.radians(lat0))+N*math.tan(phi)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))
    return x,y
def from5186(x,y):
    # 뉴턴 반복으로 역변환
    lat,lon=38.0,127.0
    for _ in range(20):
        X,Y=to5186(lat,lon); d=1e-6
        Xa,Ya=to5186(lat+d,lon); Xb,Yb=to5186(lat,lon+d)
        J=[[ (Xa-X)/d,(Xb-X)/d],[(Ya-Y)/d,(Yb-Y)/d]]; det=J[0][0]*J[1][1]-J[0][1]*J[1][0]
        dx,dy=x-X,y-Y; a,b,c,d2=J[0][0],J[0][1],J[1][0],J[1][1]; lat+=(d2*dx-b*dy)/det; lon+=(-c*dx+a*dy)/det
    return lat,lon
