//this is for praticsing fetch
//fetch will send http req
//.json() coverts data in json format

//we want to display the data in our dashboard do will use usetstae and useEffect
// firstly we are making api.js reusable so that react can call it whenever it needs it

export async function getstorage() {
    const res=await fetch("http://127.0.0.1:8000/storage")
    const data=await res.json()//collecting data in json format
    return data
}
//ye aloe wont work we need to import it in App.jsx
export async function getDevices(){
    const res=await fetch("http://127.0.0.1:8000/devices")
    const data=await res.json()
    return data
}
//this for getting each file
export async function getFiles(){
    const res=await fetch("http://127.0.0.1:8000/files")
    const data=await res.json()
    return data
}
//kosni file delete karni hai usak req bhej rhe hai
export async function deleteFile(fileId){
    const res=await fetch(
     `http://127.0.0.1:8000/files/${fileId}`,{
        method:"DELETE"
     }   
    )
    const data=await res.json()
    return data
}
export async function uploadFile(selectedFile) {
    const formData= new FormData() //basically it helps browser understand hum file bhej rahe hai
    formData.append("file",selectedFile) //adding file data to formData
    const res=await fetch("http://127.0.0.1:8000/upload",
        {
            method:"POST", // it mean swe are uploading smtg
            body:formData // jo box banya hai woh bhej rahe hai
        }
    ) 
    const data =await res.json()
    if (!res.ok){
        throw new Error(data.detail)
    }
    return data
}
//coverting response to JSON and returning it