from fastapi import FastAPI,Header,Depends
from fastapi import UploadFile,File,HTTPException
from pathlib import Path
import os,re,secrets
from fastapi.responses import FileResponse
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
    expected_token=os.environ.get("NODE_TOKEN")
    if not expected_token:
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
    return {
        "status":"online",
        "device":"My Laptop"
    }
@app.post("/chunks/{chunk_id}")
async def save_chunk(chunk_id:str,file:UploadFile=File(...)):
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
def download(chunk_id:str):
    validation(chunk_id)
    file_path=CHUNK_DIR/chunk_id
    if not file_path.is_file():
        raise HTTPException(detail="file is missing",status_code=404)
    return FileResponse(path=file_path)
@app.delete("/chunks/{chunk_id}")
def delete_file(chunk_id:str):
    validation(chunk_id)
    file_path=CHUNK_DIR/chunk_id
    if not file_path.is_file():
        raise HTTPException(detail="File doesn't exists",status_code=404)
    file_path.unlink()
    return{
        "message":"file is deleted",
        "chunk_id":chunk_id
    }
