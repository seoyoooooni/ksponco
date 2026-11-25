import struct, numpy as np
def read_shp_bbox(path, bbox):
    """polygon shp에서 bbox(E0,N0,E1,N1)와 겹치는 레코드 (index, parts[list of Nx2])"""
    E0,N0,E1,N1=bbox; out=[]
    with open(path,'rb') as f:
        f.seek(100); i=0
        while True:
            h=f.read(8)
            if len(h)<8: break
            rn,cl=struct.unpack('>2i',h); b=f.read(cl*2)
            st=struct.unpack('<i',b[:4])[0]
            if st in (5,15,25):
                x0,y0,x1,y1=struct.unpack('<4d',b[4:36])
                if x1>=E0 and x0<=E1 and y1>=N0 and y0<=N1:
                    np_,npt=struct.unpack('<2i',b[36:44])
                    parts=list(struct.unpack(f'<{np_}i',b[44:44+4*np_]))+[npt]
                    pts=np.frombuffer(b,'<f8',count=2*npt,offset=44+4*np_).reshape(npt,2)
                    out.append((i,[pts[parts[k]:parts[k+1]].copy() for k in range(np_)]))
            i+=1
    return out
def dbf_fields(path):
    with open(path,'rb') as f:
        h=f.read(32); n,hl,rl=struct.unpack('<IHH',h[4:12]); fs=[]
        while True:
            d=f.read(32)
            if d[0]==0x0D: break
            fs.append((d[:11].split(b'\0')[0].decode(), chr(d[11]), d[16]))
    return n,hl,rl,fs
def dbf_rows(path, idxs, enc='euc-kr'):
    n,hl,rl,fs=dbf_fields(path); rows={}
    with open(path,'rb') as f:
        for i in idxs:
            f.seek(hl+i*rl+1); r=f.read(rl-1); o=0; row={}
            for name,t,ln in fs:
                v=r[o:o+ln].decode(enc,'replace').strip(); o+=ln; row[name]=v
            rows[i]=row
    return fs,rows
