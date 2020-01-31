import { Injectable } from '@angular/core';
import { Platform } from'@ionic/angular';

import { Plugins, CameraResultType, Capacitor, FilesystemDirectory, CameraPhoto, CameraSource, Filesystem} from '@capacitor/core';
const { Camera, FileSystem, Storage} = Plugins;

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos : Foto[] = [];
  private PHOTO_STORAGE: string = "photos";
  private platform: Platform;

  constructor(platform: Platform) { 
    this.platform = platform;
  }

  private async readAsBase64(CameraPhoto: CameraPhoto){
    //  "hybrid" irá detectar Cordova ou Capacitor
    if (this.platform.is('hybrid')) {
      // Lê o arquivo em formato base64
      const file = await Filesystem.readFile({
        path: CameraPhoto.path
      });

      return file.data;
    }
    else  {
      //  Busca a foto, a interpreta como um blob e então a converte para o formato base64
      const response = await fetch(CameraPhoto.webPath!);
      const blob = await response.blob();

      return await this.convertBlobToBase64(blob) as string;
    }
  
  }

  convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) =>{
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });

  private async getPhotoFile(cameraPhoto, fileName) {
    if(this.platform.is('hybrid')) {
      // Pega o novo e completo filepath da foto salva no sistema
      const fileUri = await FileSystem.getUri({
        directory: FilesystemDirectory.Data,
        path: fileName
      });

      // Mostra a nova imagem ao reescrever o caminho 'file://' em HTTP
      // Mais detalhes:  https://ionicframework.com/docs/building/webview#file-protocol  
      return {
        filepath: fileUri.Uri,
        webviewPath: Capacitor.convertFileSrc(fileUri.Uri),
      };
    }
    else{
      // Usa o webPath para mostrar a nova imagem ao invés de base64
      // uma vez que, já está carregado na memória
      return{
        filepath: fileName,
        webviewPath: cameraPhoto.webPath
      };
    }
  }
  
  private async savePicture(CameraPhoto: CameraPhoto) {
    //  Converter a foto para base64 de forma que o FilesSystem API possa salva-la
    const base64Data = await this.readAsBase64(CameraPhoto);

    //  Passa a foto para o diretório de dados da API
    const fileName = new Date().getTime() + '.jpeg';
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data
    });

    //  Recupera os caminhos de arquivos específicos de cada plataforma
    return await this.getPhotoFile(CameraPhoto, fileName);
   }

  public async tirarfoto() {
    // Tirar uma foto
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri, 
      source: CameraSource.Camera, 
      quality: 100
    });

    //  salvar a foto
    const savedImageFile : any = await this.savePicture(capturedPhoto);
    this.photos.unshift(savedImageFile);

    Storage.set({
      key: this.PHOTO_STORAGE,
      value:  this.platform.is('hybrid')
                ? JSON.stringify(this.photos) 
                : JSON.stringify(this.photos.map(p => {
                //  Não salva o representativo em base64 dos dados da foto,
                //  já que ele já está salvo no Filesystem
                const photoCopy = { ...p };
                delete photoCopy.base64;

                return photoCopy;
            }))
    });
  }

  public async loadSaved(){
    //  Recupera o array de dados da foto que está na cache
    const photos = await Storage.get({ key: this.PHOTO_STORAGE });
    this.photos = JSON.parse(photos.value) || [];

    // Quando a plataforma não for hibrida faça isso
    if(!this.platform.is('hybrid')){
      //  Mostra a foto lendo o formato base64
      for (let photo of this.photos) {
        //  Lê os dados de cada foto salva no filesystem
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: FilesystemDirectory.Data
        });

        //  Somente para plataformas web: Salva a foto no campo da base64
        photo.base64 = 'data:image/jpec;base64,${readFile.data}';
      }
    }
  }

}

interface Foto{
  filepath: string;
  webviewPath: string;
  base64?: string;
}




