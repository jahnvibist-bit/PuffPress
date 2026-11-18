from fastapi import FastAPI,Header,Depends
from fastapi import UploadFile,File,HTTPException
from pathlib import Path
import os,re,secrets
from fastapi.responses import FileResponse
import shutil
app=FastAPI()
CHUNK_DIR=Path(__file__).resolve().parent/"chunks" #tells python where chunk is stored
#Path file ke andar ka loc  __file__ current file 
# .resolve uska full path . parent jis folder mein agent.py that is node-agent
#  /"chunks" innner folder path
max_chunk_size=5*1024*1024
CHUNK_DIR.mkdir(parents=True,exist_ok=True)
#even if parent folder is absent make chunk folder
#creating a validation fn to test validation each time 
def verify_node_token(x_node_token: str | None = Header(default=None)): #collecting token form users and can be string or missing
    expected_token=os.environ.get("NODE_TOKEN") #getting node token
    #Header(default=None)	FastAPI ko bolo X-Node-Token header read kare
    if not expected_token: #secret is missing
        raise HTTPException(
            status_code=503,
            detail="Node authentication is not configured"
        )

    if x_node_token is None or not secrets.compare_digest(
        x_node_token, expected_token
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized device"
        )
def validation(chunk_id:str):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}",chunk_id):
        raise HTTPException(status_code=400,detail="Invalid chunk ID")
@app.get("/health")
def health():
    usage=shutil.disk_usage(".")
    free_gb=round(usage.free/(1024**3),2)
    return {
        "status":"online",
        "device":"My Laptop",
        "free_gb":free_gb
    }
@app.post("/chunks/{chunk_id}") 
async def save_chunk(chunk_id:str,file:UploadFile=File(...),_:None=Depends(verify_node_token)):
    #dependsolder () means make security testing run
    #_ plach
    validation(chunk_id)
    file_path=CHUNK_DIR/chunk_id #/ used for joining path
    content=await file.read(max_chunk_size+1) # uplaod file read karna
    if len(content)>max_chunk_size:
        raise HTTPException(status_code=413,detail="Chunk exceeds 5 MiB limit")
    #413 meann uploaded file too large
    file_path.write_bytes(content) #writing on disk
    return{
        "chunk_id":chunk_id,
        "status":"saved"
    }
@app.get("/chunks/{chunk_id}/download")
def download(chunk_id:str,_: None = Depends(verify_node_token)):
    validation(chunk_id)
    file_path=CHUNK_DIR/chunk_id
    if not file_path.is_file():
        raise HTTPException(detail="file is missing",status_code=404)
    return FileResponse(path=file_path)
@app.delete("/chunks/{chunk_id}")
def delete_file(chunk_id:str,_: None = Depends(verify_node_token)):
    validation(chunk_id)
    file_path=CHUNK_DIR/chunk_id
    if file_path.is_file():
        file_path.unlink()
        status = "deleted"
    else:
        status = "already_missing"
    return {
        "message": "Chunk is absent",
        "chunk_id": chunk_id,
        "status": status
    }