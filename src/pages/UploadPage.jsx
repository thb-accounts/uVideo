import { useEffect, useRef, useState } from 'react'
import { createContent, getProfile } from '../lib/contentApi'
import { uploadVideoToBunnyStream, deleteBunnyUpload } from '../lib/bunnyStreamUpload'
import { uploadVideoToCloudinary } from '../lib/cloudinaryUpload'
import { useAuth } from '../context/useAuth'
import { Link } from 'react-router-dom'

const UploadIcon=()=> <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M11 16h2V8.8l2.6 2.6L17 10l-5-5-5 5 1.4 1.4L11 8.8V16Zm-6 3h14v2H5v-2Z"/></svg>

export default function UploadPage(){
 const {user}=useAuth(); const formRef=useRef(null); const submitLockRef=useRef(false); const uploadAbortRef=useRef(null)
 const [status,setStatus]=useState(''); const [submitting,setSubmitting]=useState(false); const [selectedFileName,setSelectedFileName]=useState('')
 const [username,setUsername]=useState(user?.user_metadata?.username||''); const [verificationStatus,setVerificationStatus]=useState(null); const [profileLoading,setProfileLoading]=useState(true)

 useEffect(()=>{let active=true;if(user?.id){getProfile(user.id).then(profile=>{if(!active)return;setVerificationStatus(profile?.age_verification_status||'unverified');if(profile?.username)setUsername(profile.username);setProfileLoading(false)})}else setProfileLoading(false);return()=>{active=false}},[user?.id])

 async function handleSubmit(event){
  event.preventDefault(); if(submitLockRef.current)return; submitLockRef.current=true
  const form=formRef.current||event.currentTarget; const fd=new FormData(form); let mediaUrl=String(fd.get('media_url')||'').trim()
  const videoFile=fd.get('video_file'), captionUrl=String(fd.get('caption_url')||'').trim(), thumbnailUrl=String(fd.get('thumbnail_url')||'').trim()
  const title=String(fd.get('title')||'').trim(), description=String(fd.get('description')||'').trim(), category=String(fd.get('category')||'General').trim(), contentType=String(fd.get('content_type')||'video').trim(), points=Number(fd.get('points'))||20
  const hasLocalFile=videoFile&&videoFile.size>0
  if(!hasLocalFile&&!mediaUrl){setStatus('Choose a video file or paste a direct video link.');submitLockRef.current=false;return}
  if(!hasLocalFile&&mediaUrl&&!/^https?:\/\//i.test(mediaUrl)){setStatus('Backup links must be direct video URLs.');submitLockRef.current=false;return}
  if(captionUrl&&!captionUrl.toLowerCase().endsWith('.vtt')){setStatus('Only .vtt caption files are supported.');submitLockRef.current=false;return}
  setSubmitting(true);setStatus(hasLocalFile?'Preparing upload…':'Publishing video…')
  try{
   if(!user?.id)throw new Error('Sign in before publishing a video.')
   if(!username)throw new Error('Set a username in Profile before publishing.')
   let storageProvider='external',storageKey=null,cloudinaryPublicId=null
   if(hasLocalFile){
    const controller=new AbortController();uploadAbortRef.current=controller
    const metadata={title,description,category,type:contentType,username,points}
    try{
     const bunnyResult=await uploadVideoToBunnyStream(videoFile,metadata,{signal:controller.signal,onProgress:p=>setStatus(`Uploading video: ${p}%`)})
     form?.reset();setSelectedFileName('');setStatus(bunnyResult.status?.uploadStatus==='ready'?'Video is ready to publish.':'Video uploaded. Processing…');return
    }catch(err){
     if(err?.name==='AbortError'){if(err.contentId)await deleteBunnyUpload(err.contentId).catch(()=>{});throw err}
     if(err?.bunnyAccepted)throw new Error('The upload was accepted, but processing could not be confirmed. Check your dashboard before retrying.')
     setStatus('Primary upload failed. Switching to backup upload…')
     const result=await uploadVideoToCloudinary(videoFile,{signal:controller.signal,onProgress:p=>setStatus(`Uploading backup: ${p}%`)})
     mediaUrl=result.mediaUrl;storageProvider=result.provider;storageKey=result.storageKey;cloudinaryPublicId=result.cloudinaryPublicId
    }finally{uploadAbortRef.current=null}
   }
   await createContent({user_id:user.id,title,description,username,type:contentType,media_url:mediaUrl,caption_url:captionUrl||null,thumbnail_url:thumbnailUrl||null,storage_provider:storageProvider,storage_key:storageKey,cloudinary_public_id:cloudinaryPublicId,bunny_video_id:null,bunny_library_id:null,upload_status:'ready',uploaded_at:new Date().toISOString(),ready_at:new Date().toISOString(),category,points,recommended:false,is_trending:false})
   form?.reset();setSelectedFileName('');setStatus('Video published.')
  }catch(err){setStatus(err instanceof Error?err.message:'Your video could not be published.')}finally{setSubmitting(false);submitLockRef.current=false}
 }

 if(profileLoading)return <div className="mx-auto max-w-3xl p-8 text-sm text-[#5f6368]">Checking creator access…</div>
 if(verificationStatus!=='approved')return <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><h1 className="text-2xl font-medium text-[#202124]">Creator access required</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#5f6368]">Creators must be at least 15, or use an account managed by a parent. Contact the MPlace Videos creator team to continue.</p><Link className="mt-6 inline-flex rounded-full bg-[#1f6f4a] px-5 py-2.5 text-sm font-medium text-white" to="/verification">Get in touch</Link></div>

 const field='theme-input min-h-12 rounded-lg border px-3.5 py-2.5 text-sm'
 return <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
  <div className="mb-8"><h1 className="text-2xl font-medium text-[#202124]">Create a video</h1><p className="mt-1 text-sm text-[#5f6368]">Upload and publish to MPlace Videos as @{username}.</p></div>
  <form ref={formRef} onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white">
   <section className="border-b border-[var(--app-border)] p-6 sm:p-8">
    <div className="mb-6 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#e7f3ec] text-[#185c3d]"><UploadIcon/></div><div><h2 className="font-medium text-[#202124]">Video details</h2><p className="text-sm text-[#5f6368]">Add the information viewers will see.</p></div></div>
    <div className="grid gap-5">
     <label className="grid gap-2 text-sm font-medium text-[#3c4043]">Title<input className={field} name="title" placeholder="Add a title" required/></label>
     <label className="grid gap-2 text-sm font-medium text-[#3c4043]">Description<textarea className={field+' min-h-28 resize-y'} name="description" placeholder="Tell viewers about your video" required/></label>
     <div className="grid gap-5 sm:grid-cols-3">
      <label className="grid gap-2 text-sm font-medium text-[#3c4043]">Format<select className={field} name="content_type" defaultValue="video"><option value="video">Regular video</option><option value="short">Blink</option></select></label>
      <label className="grid gap-2 text-sm font-medium text-[#3c4043]">Category<select className={field} name="category" defaultValue="General"><option>General</option><option>Tutorial</option><option>Coding</option><option>Shorts</option></select></label>
      <label className="grid gap-2 text-sm font-medium text-[#3c4043]">Points<input className={field} name="points" type="number" min="5" defaultValue="20"/></label>
     </div>
    </div>
   </section>
   <section className="p-6 sm:p-8">
    <h2 className="font-medium text-[#202124]">Media</h2><p className="mt-1 text-sm text-[#5f6368]">Choose a local file. Advanced URL fields are optional.</p>
    <label className="mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#bdc1c6] bg-[#f8f9fa] p-5 text-center hover:bg-[#f1f3f4]"><UploadIcon/><span className="mt-2 text-sm font-medium text-[#1f6f4a]">{selectedFileName||'Choose video file'}</span><input accept="video/*" className="sr-only" name="video_file" type="file" onChange={e=>setSelectedFileName(e.target.files?.[0]?.name||'')}/></label>
    <details className="mt-5 border-t border-[var(--app-border)] pt-5"><summary className="cursor-pointer text-sm font-medium text-[#1f6f4a]">Advanced options</summary><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Thumbnail URL<input className={field} name="thumbnail_url" type="url"/></label><label className="grid gap-2 text-sm font-medium">Direct video URL<input className={field} name="media_url" type="url"/></label><label className="grid gap-2 text-sm font-medium sm:col-span-2">Caption URL (.vtt)<input className={field} name="caption_url" type="url"/></label></div></details>
   </section>
   <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] bg-[#f8f9fa] px-6 py-4 sm:px-8">{status?<p className="text-sm text-[#5f6368]" role="status">{status}</p>:<span/>}<div className="ml-auto flex gap-2">{submitting&&<button type="button" onClick={()=>uploadAbortRef.current?.abort()} className="rounded-full px-4 py-2 text-sm font-medium text-[#1f6f4a] hover:bg-[#e7f3ec]">Cancel</button>}<button disabled={submitting} className="rounded-full bg-[#1f6f4a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#185c3d] disabled:opacity-60">{submitting?'Publishing…':'Publish'}</button></div></footer>
  </form>
 </div>
}
