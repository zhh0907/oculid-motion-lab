"""Offline checkerboard intrinsics. Images never leave the user's computer.

python calibrate_camera.py --images captures --square-mm 25 --output intrinsics.json
Use raw frames captured by the web app, not mirrored preview screenshots.
"""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np

def calibrate(folder, cols=9, rows=6, square_mm=25):
    if not (3 <= cols <= 30 and 3 <= rows <= 30 and 1 <= square_mm <= 200):
        raise ValueError('Invalid board dimensions or square size.')
    files=sorted(p for p in Path(folder).iterdir() if p.suffix.lower() in {'.png','.jpg','.jpeg'})
    obj=np.zeros((rows*cols,3),np.float32)
    obj[:,:2]=np.mgrid[0:cols,0:rows].T.reshape(-1,2)*square_mm/1000
    objects=[]; corners=[]; accepted=[]; rejected=[]; size=None
    for file in files:
        image=cv2.imdecode(np.fromfile(file,dtype=np.uint8),cv2.IMREAD_GRAYSCALE)
        if image is None:
            rejected.append({'file':file.name,'reason':'unreadable'});continue
        frame_size=(image.shape[1],image.shape[0])
        if size is not None and frame_size != size:
            raise ValueError('All calibration frames must have the same resolution.')
        found,points=cv2.findChessboardCornersSB(image,(cols,rows),flags=cv2.CALIB_CB_NORMALIZE_IMAGE)
        if not found:
            rejected.append({'file':file.name,'reason':'board not detected'});continue
        if any(np.sqrt(np.mean((points-old)**2))<3 for old in corners):
            rejected.append({'file':file.name,'reason':'near-duplicate view'});continue
        size=frame_size;objects.append(obj.copy());corners.append(points);accepted.append(file.name)
    if len(corners)<10:
        raise ValueError(f'Only {len(corners)} distinct valid views. Capture at least 10 with varied tilt, position and distance. Rejected: {rejected}')
    rms,K,dist,rvecs,tvecs=cv2.calibrateCamera(objects,corners,size,None,None)
    errors=[]
    for xyz,uv,r,t in zip(objects,corners,rvecs,tvecs):
        projected,_=cv2.projectPoints(xyz,r,t,K,dist)
        errors.append(float(np.sqrt(np.mean(np.sum((uv-projected)**2,axis=2)))))
    if not np.isfinite(K).all() or not np.isfinite(dist).all() or not (K[0,0]>10 and K[1,1]>10 and 0<=K[0,2]<=size[0] and 0<=K[1,2]<=size[1]):
        raise ValueError('Implausible calibration. Use varied, sharply focused checkerboard views.')
    return {'version':1,'type':'camera-intrinsics','intrinsics':{
        'width':size[0],'height':size[1],'fx':float(K[0,0]),'fy':float(K[1,1]),
        'cx':float(K[0,2]),'cy':float(K[1,2]),'distortion':dist.ravel().tolist(),
        'source':'checkerboard','rmsPx':float(rms)},
        'diagnostics':{'accepted':accepted,'rejected':rejected,'perViewRmsPx':errors,
        'boardInnerCorners':[cols,rows],'squareMm':square_mm,
        'warning':'Training-view reprojection error is not an independent accuracy estimate. Camera-to-screen pose is NOT solved by this tool.'}}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--images',required=True,type=Path)
    ap.add_argument('--cols',type=int,default=9);ap.add_argument('--rows',type=int,default=6)
    ap.add_argument('--square-mm',type=float,default=25)
    ap.add_argument('--output',type=Path,default=Path('camera-intrinsics.json'))
    args=ap.parse_args()
    result=calibrate(args.images,args.cols,args.rows,args.square_mm)
    args.output.write_text(json.dumps(result,indent=2,allow_nan=False),encoding='utf-8')
    print(f'Saved {args.output}; {len(result["diagnostics"]["accepted"])} views; RMS {result["intrinsics"]["rmsPx"]:.3f} px')
    print('Check a separate board view. Measure camera-to-screen pose separately. Keep capture resolution, crop and focus fixed.')
    if result['intrinsics']['rmsPx']>1:print('WARNING: RMS exceeds 1 pixel. Inspect blur, board flatness and view diversity before use.')
if __name__=='__main__':main()
