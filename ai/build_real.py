# 실측 장소 데이터 만들기: 점군(로컬) → 위성 맞춤(회전·원점) → 장소 좌표(+x 동, +z 남, +y 위)
import sys, json, base64, numpy as np
sys.path.insert(0,'/home/claude/scripts')
from tm import to5186
from scipy import ndimage
from scipy.spatial import cKDTree

VEN = {
 'lawn88': dict(npy='/home/claude/l88_sub.npy', hag='/home/claude/l88_hag.npy', origin_ll=(37.51907307551449,127.12480727425854),
                th=225.0, pre=(0.6,-0.15), scanR=46, sat='ai/sat_cells_lawn88.b64', name='88잔디마당',
                note='가운데 원형 광장 중심 (점군 광장 고리를 위성 영상에 맞춘 점)'),
 'lake':   dict(npy='/home/claude/lake_02.npy', hag='/home/claude/lake_hag.npy', origin_ll=(37.52120576755575,127.12543145557632),
                th=49.5, pre=(0.0,-0.1), scanR=27, sat='ai/sat_cells_lake.b64', name='88호수 수변무대',
                note='원형 고정 무대 중심 (점군 무대 원을 위성 영상에 맞춘 점)'),
}
EXT=80   # 지형 격자 반폭 (m)
POND=[[-60.8,98.3],[-41.1,110.5],[-10.8,113.5],[22.5,110.5],[34.7,98.3],[31.6,80.1],[16.5,55.9],[13.4,34.7],[4.3,16.5],[-19.9,13.5],[-38.1,19.5],[-53.2,31.6],[-62.3,49.8],[-62.3,74.1]]  # 호수 윤곽 E,N

def to_venue(sx, sy, v):
    px, py = sx+v['pre'][0], sy+v['pre'][1]
    t=np.radians(v['th']); c,s=np.cos(t),np.sin(t)
    E = px*c - py*s; N = px*s + py*c
    return E, -N   # x=동, z=남

def b64cells(path):
    raw=base64.b64decode(open(path).read().strip()); a=np.frombuffer(raw,'<i2').reshape(-1,2)/10.0
    return a  # E,N

B=json.load(open('/home/claude/raw/gis/park_bldg.json'))
out={}
for vid,v in VEN.items():
    P=np.load(v['npy']); hag=np.load(v['hag']); sx,sy,sz=P[:,0],P[:,1],P[:,2]
    X,Z=to_venue(sx,sy,v)
    # ── 지형: 바닥 점(바닥 위 0.3m 미만) 1m 칸 하위 20%
    g=hag<0.3; nx=nz=2*EXT+1; x0=z0=-EXT
    ix=np.round(X[g]-x0).astype(int); iz=np.round(Z[g]-z0).astype(int); ok=(ix>=0)&(iz>=0)&(ix<nx)&(iz<nz)
    key=iz[ok]*nx+ix[ok]; zz=sz[g][ok]; o=np.lexsort((zz,key)); ks=key[o]; zs=zz[o]
    H=np.full(nx*nz,np.nan); st=np.r_[0,np.nonzero(np.diff(ks))[0]+1]; en=np.r_[st[1:],len(ks)]
    for a,b in zip(st,en): H[ks[a]]=zs[a+int(0.2*(b-a-1))]
    H=H.reshape(nz,nx); have=~np.isnan(H)
    # 작은 빈칸(스캐너 자리 등)은 보간, 바깥은 가장 가까운 값
    near=ndimage.binary_closing(have,iterations=3)
    idx=ndimage.distance_transform_edt(~have,return_distances=False,return_indices=True)
    Hf=H[idx[0],idx[1]]
    # 점군 밖으로 이어 붙인 부분은 부드럽게
    sm=ndimage.uniform_filter(Hf,5); Hf=np.where(near,Hf,sm)
    src=np.where(near,0,1).astype(int)
    terrain=dict(x0=x0,z0=z0,nx=nx,nz=nz,cell=1,h=[round(float(h),2) for h in Hf.ravel()],src=src.ravel().tolist())
    gbase=float(np.median(Hf[src==1])) if (src==1).any() else float(np.median(Hf))
    # ── 나무(점군): 수관 높이 지도 꼭대기점
    m=hag>2; TX,TZ,TH=X[m],Z[m],hag[m]; c=0.5
    gx=((TX+EXT)/c).astype(int); gz=((TZ+EXT)/c).astype(int); CHM=np.zeros((int(2*EXT/c)+2,)*2); np.maximum.at(CHM,(gz,gx),TH)
    S=ndimage.gaussian_filter(CHM,1.0); pk=np.argwhere((S==ndimage.maximum_filter(S,size=9))&(S>3))
    pz=pk[:,0]*c-EXT+c/2; px=pk[:,1]*c-EXT+c/2
    _,own=cKDTree(np.c_[px,pz]).query(np.c_[TX,TZ])
    trees=[]
    for k in range(len(pk)):
        sel=own==k
        if sel.sum()<15: continue
        hx,hz,hh=TX[sel],TZ[sel],TH[sel]; cx,cz=hx.mean(),hz.mean()
        trees.append(dict(x=round(float(cx),2),z=round(float(cz),2),h=round(float(np.percentile(hh,98)),2),
                          base=round(float(max(1.5,np.percentile(hh,5))),2),r=round(float(max(1.0,np.percentile(np.hypot(hx-cx,hz-cz),90))),2),source='scan'))
    hs=np.median([t['h'] for t in trees]); bs=np.median([t['base'] for t in trees])
    # ── 나무(위성): 8m 칸 수관, 높이는 점군 나무 중앙값
    cells=b64cells(v['sat'])
    from matplotlib.path import Path
    pond=Path([[x,-n] for x,n in POND]) if vid=='lake' else None
    for E,N in cells:
        x,z=float(E),float(-N)
        if abs(x)>EXT+60 or abs(z)>EXT+60: continue
        if pond is not None and pond.contains_point((x,z),radius=-4): continue   # 호수 연잎 제외
        trees.append(dict(x=round(x,1),z=round(z,1),h=round(float(hs),1),base=round(float(bs),1),r=5.7,source='satellite'))
    # ── 건물(GIS): 원점 반경 350m
    oE,oN=to5186(*v['origin_ll']); blds=[]
    for b in B:
        if np.hypot(b['cx']-oE,b['cy']-oN)>350: continue
        h=b['h'] if b['h']>0 else (b['fl']*3.3 if b['fl']>0 else 4.0)
        poly=np.array(b['parts'][0]); 
        if len(poly)>40: poly=poly[::int(np.ceil(len(poly)/40))]
        fp=[[round(float(px_-oE),2),round(float(-(py_-oN)),2)] for px_,py_ in poly]
        name=(b['name']+' '+b['dong']).strip() or b['use'] or '건물'
        blds.append(dict(name=name,base=round(gbase,2),height=round(float(h),1),footprint=fp,source='gis'))
    lat,lon=v['origin_ll']
    venue=dict(id=vid,name=v['name'],origin5186=[round(oE,2),round(oN,2)],originNote=v['note'],lat=round(lat,7),lon=round(lon,7),
               northRotationDeg=v['th'],stage='temporary' if vid=='lawn88' else 'fixed',fixedStage=None,
               seating='lawn' if vid=='lawn88' else 'terrace',defaultLayout='layout_default.json')
    if vid=='lake':
        t=np.radians(v['th']); c_,s_=np.cos(t),np.sin(t)
        # 객석 방향 = 점군 -y → 무대는 객석 쪽을 바라봄
        E,N=0*c_-(-1)*s_, 0*s_+(-1)*c_; az=(np.degrees(np.arctan2(E,N))+360)%360
        venue['fixedStage']=dict(shape='circle',x=0.0,z=0.0,r=9.4,deckH=0.2,roofH=None,azimuth=round(float(az),1))
        venue['water']=[[x,-n] for x,n in POND]
    out[vid]=dict(venue=venue,terrain=terrain,trees=trees,buildings=blds)
    d=f'web/public/data/{vid}'; import os; os.makedirs(d,exist_ok=True)
    for k,val in out[vid].items(): json.dump(val,open(f'{d}/{k}.json','w'),ensure_ascii=False,separators=(',',':'))
    ns=sum(t['source']=='scan' for t in trees)
    print(vid,'origin5186',venue['origin5186'],'trees scan',ns,'sat',len(trees)-ns,'bldg',len(blds),'terrain src0',int((src==0).sum()),
          'h range',round(float(Hf.min()),2),round(float(Hf.max()),2),'gbase',round(gbase,2), venue.get('fixedStage'))
